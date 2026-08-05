use crate::models::metadata::*;

pub fn generate_create_table_sql(design: &TableDesign) -> String {
    let mut sql = format!("CREATE TABLE `{}` (\n", design.name);
    for (i, col) in design.columns.iter().enumerate() {
        if i > 0 { sql.push_str(",\n"); }
        sql.push_str(&format!("  `{}` {}", col.name, col.column_type));
        if col.is_nullable.to_ascii_lowercase() == "no" { sql.push_str(" NOT NULL"); }
        if let Some(ref def) = col.column_default {
            sql.push_str(&format!(" DEFAULT {}", def));
        }
        if col.extra.to_ascii_lowercase().contains("auto_increment") { sql.push_str(" AUTO_INCREMENT"); }
    }
    if let Some(pk_col) = design.columns.iter().find(|c| c.column_key == "PRI") {
        sql.push_str(&format!(",\n  PRIMARY KEY (`{}`)", pk_col.name));
    }
    sql.push_str("\n)");
    sql
}

pub fn generate_alter_table_sql(original: &TableDesign, modified: &TableDesign) -> String {
    let mut sql = format!("ALTER TABLE `{}`", original.name);
    let mut first = true;
    for col in &modified.columns {
        if !original.columns.iter().any(|c| c.name == col.name) {
            if first { sql.push(' '); first = false; } else { sql.push_str(", "); }
            sql.push_str(&format!("ADD COLUMN `{}` {}", col.name, col.column_type));
        }
    }
    for col in &original.columns {
        if let Some(new_col) = modified.columns.iter().find(|c| c.name == col.name) {
            if col.column_type != new_col.column_type {
                if first { sql.push(' '); first = false; } else { sql.push_str(", "); }
                sql.push_str(&format!("MODIFY COLUMN `{}` {}", col.name, new_col.column_type));
            }
        } else {
            if first { sql.push(' '); first = false; } else { sql.push_str(", "); }
            sql.push_str(&format!("DROP COLUMN `{}`", col.name));
        }
    }
    sql
}
