use crate::core::database::traits::{DatabaseAdapter, DbConnectionHandle};
use crate::errors::AppResult;
use crate::models::backup::*;
use crate::models::connection::ConnectionProfile;
use crate::models::metadata::RoutineDetail;
use std::io::Write;

pub async fn execute_backup(
    adapter: &dyn DatabaseAdapter,
    handle: &DbConnectionHandle,
    options: &BackupOptions,
    output_path: &str,
    schema: &str,
    profile: &ConnectionProfile,
    selected_tables: Option<&[String]>,
    selected_views: Option<&[String]>,
    selected_routines: Option<&[String]>,
) -> AppResult<BackupResult> {
    let start = std::time::Instant::now();
    // schema 由前端传入，指定要备份的单一数据库；为空时回退到 "unknown"（兼容调度等无 schema 场景）
    let schema = if schema.is_empty() { "unknown".to_string() } else { schema.to_string() };
    // 用户在前端对话框选定的输出路径优先；为空时回退到默认路径
    let requested = if output_path.is_empty() { None } else { Some(output_path) };
    let output_path = super::dump_format::resolve_output_path(&schema, requested, options.compress_output)?;

    // 流式写入：用 BufWriter<File>（或 GzEncoder<BufWriter<File>>）替代 String buffer
    let file = std::fs::File::create(&output_path)?;
    let mut writer: Box<dyn Write + Send> = if options.compress_output {
        Box::new(flate2::write::GzEncoder::new(
            std::io::BufWriter::new(file),
            flate2::Compression::new(options.compression_level.unwrap_or(6) as u32),
        ))
    } else {
        Box::new(std::io::BufWriter::new(file))
    };

    // ===== Header =====
    writer.write_all(adapter.dump_header_sql(options, profile, &schema).as_bytes())?;
    writer.write_all(b"\n")?;

    // 过滤函数：判断对象是否在用户选择列表中
    let is_selected = |name: &str, filter: Option<&[String]>| -> bool {
        match filter {
            None => true,
            Some(list) => list.is_empty() || list.iter().any(|s| s == name),
        }
    };

    if adapter.is_system_database(&schema) {
        // 系统库跳过备份
        writer.write_all(b"-- System database, skipped\n")?;
    } else {
        let all_tables = adapter.list_tables(handle, &schema).await?;
        let tables: Vec<String> = all_tables.iter()
            .filter(|t| is_selected(t, selected_tables))
            .cloned()
            .collect();

        // ===== 表 DDL =====
        if options.include_structure {
            for table in &tables {
                let q = adapter.quote_identifier(table);
                writer.write_all(format!(
                    "\n-- =====================================\n-- Table DDL: {}\n-- =====================================\n",
                    q
                ).as_bytes())?;
                if options.add_drop_table {
                    writer.write_all(format!("DROP TABLE IF EXISTS {};\n", q).as_bytes())?;
                }
                let ddl = adapter.load_ddl(handle, &schema, table).await?;
                let reformatted = adapter.reformat_table_ddl_for_dump(&ddl);
                writer.write_all(reformatted.as_bytes())?;
                writer.write_all(b"\n")?;
            }
        }

        // ===== 表数据 =====
        if options.include_data {
            for table in &tables {
                let q = adapter.quote_identifier(table);
                let q_db = adapter.quote_identifier(&schema);
                let sql = format!("SELECT * FROM {}.{}", q_db, q);
                let result = adapter.query(handle, &sql).await?;
                if result.rows.is_empty() { continue; }

                writer.write_all(format!(
                    "\n-- =====================================\n-- Table Data: {}\n-- =====================================\n",
                    q
                ).as_bytes())?;

                let col_names: Vec<String> = result.columns.iter()
                    .map(|c| adapter.quote_identifier(&c.name))
                    .collect();
                let cols_joined = col_names.join(", ");
                let col_types: Vec<String> = result.columns.iter().map(|c| c.type_name.clone()).collect();
                let batch_size = options.insert_batch_size.unwrap_or(200);

                for chunk in result.rows.chunks(batch_size) {
                    writer.write_all(format!("INSERT INTO {} ({})\nVALUES\n", q, cols_joined).as_bytes())?;
                    let mut rows_out = Vec::with_capacity(chunk.len());
                    for row in chunk {
                        let vals: Vec<String> = row.iter().enumerate().map(|(idx, v)| {
                            let ct = col_types.get(idx).map(|s| s.as_str()).unwrap_or("");
                            adapter.format_value_for_dump(v, ct)
                        }).collect();
                        rows_out.push(format!("  ({})", vals.join(", ")));
                    }
                    writer.write_all(rows_out.join(",\n").as_bytes())?;
                    writer.write_all(b";\n")?;
                }
            }
        }

        // ===== 触发器（数据后、视图前）=====
        if options.include_triggers {
            for table in &tables {
                let triggers = adapter.list_triggers(handle, &schema, table).await?;
                for t in &triggers {
                    let tq = adapter.quote_identifier(&t.name);
                    writer.write_all(format!(
                        "\n--\n-- Trigger `{}`\n--\n",
                        t.name
                    ).as_bytes())?;
                    writer.write_all(format!("DROP TRIGGER IF EXISTS {};\n", tq).as_bytes())?;
                    let ddl = adapter.show_create_trigger(handle, &schema, &t.name).await?;
                    writer.write_all(format!("DELIMITER $$\n{}$$\nDELIMITER ;\n", ddl).as_bytes())?;
                }
            }
        }

        // ===== 视图 =====
        if options.include_views {
            let all_views = adapter.list_views(handle, &schema).await?;
            let views: Vec<String> = all_views.iter()
                .filter(|v| is_selected(v, selected_views))
                .cloned()
                .collect();
            for view in &views {
                let q = adapter.quote_identifier(view);
                writer.write_all(format!(
                    "\n-- =====================================\n-- View DDL: {}\n-- =====================================\n",
                    q
                ).as_bytes())?;
                let ddl = adapter.show_create_view(handle, &schema, view).await?;
                let reformatted = adapter.reformat_view_ddl_for_dump(&ddl, &schema);
                writer.write_all(reformatted.as_bytes())?;
            }
        }

        // ===== 存储过程 =====
        if options.include_routines {
            let all_routines = adapter.list_routines_with_details(handle, &schema).await?;
            let routines: Vec<RoutineDetail> = all_routines.into_iter()
                .filter(|r| is_selected(&r.name, selected_routines))
                .collect();
            for r in &routines {
                let rq = adapter.quote_identifier(&r.name);
                let drop_kw = if r.routine_type.eq_ignore_ascii_case("FUNCTION") { "FUNCTION" } else { "PROCEDURE" };
                writer.write_all(format!(
                    "\n-- =====================================\n-- {} DDL: {}\n-- =====================================\n",
                    drop_kw, rq
                ).as_bytes())?;
                writer.write_all(format!("DROP {} IF EXISTS {};\n", drop_kw, rq).as_bytes())?;
                let ddl = adapter.show_create_routine(handle, &schema, &r.name, &r.routine_type).await?;
                writer.write_all(format!("DELIMITER $$\n{}$$\nDELIMITER ;\n", ddl).as_bytes())?;
            }
        }
    }

    // ===== Footer =====
    writer.write_all(adapter.dump_footer_sql().as_bytes())?;
    writer.flush()?;

    let duration = start.elapsed().as_millis() as u64;
    Ok(BackupResult { output_path, duration_ms: duration })
}
