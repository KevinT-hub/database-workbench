use sqlx::Row;
use crate::errors::AppResult;
use crate::models::user::*;
use std::collections::BTreeMap;

type Pool = sqlx::mysql::MySqlPool;

pub async fn get_all_users(pool: &Pool) -> AppResult<Vec<UserSummary>> {
    let rows = sqlx::query("SELECT User, Host, plugin, account_locked, password_expired FROM mysql.user").fetch_all(pool).await?;
    Ok(rows.iter().map(|r| {
        let u = decode_string(r, 0).unwrap_or_default();
        let h = decode_string(r, 1).unwrap_or_default();
        let pl = decode_string(r, 2);
        let l = decode_string(r, 3);
        let e = decode_string(r, 4);
        let st = build_status(l.as_deref(), e.as_deref());
        UserSummary { username: u, host: h, plugin: pl, status: st }
    }).collect())
}

pub async fn get_user_detail(pool: &Pool, username: &str, host: &str) -> AppResult<String> {
    let mut d = String::new();
    d.push_str("Username: "); d.push_str(username); d.push('\n');
    d.push_str("Host: "); d.push_str(host); d.push_str("\n\n");
    let gsql = format!("SHOW GRANTS FOR '{}'@'{}'", esc(username), esc(host));
    if let Ok(gs) = sqlx::query(&gsql).fetch_all(pool).await {
        d.push_str("Grants:\n----------------------------\n");
        for g in &gs { d.push_str(&g.get::<String, _>(0)); d.push('\n'); }
    }
    let asql = "SELECT plugin, authentication_string FROM mysql.user WHERE User=? AND Host=?";
    if let Ok(rows) = sqlx::query(asql).bind(username).bind(host).fetch_all(pool).await {
        if let Some(r) = rows.first() {
            let pl = decode_string(r, 0); let au = decode_string(r, 1);
            d.push_str("\nAuthentication:\n----------------------------\nPlugin: ");
            d.push_str(pl.as_deref().unwrap_or("")); d.push('\n');
            d.push_str("Password set: "); d.push_str(if au.as_ref().map(|s|!s.is_empty()).unwrap_or(false){"Yes"}else{"No"}); d.push('\n');
        }
    }
    Ok(d)
}

pub async fn get_user_model(pool: &Pool, username: &str, host: &str) -> AppResult<UserModelPayload> {
    let rows = sqlx::query("SELECT plugin FROM mysql.user WHERE User=? AND Host=?").bind(username).bind(host).fetch_all(pool).await?;
    let pl = rows.first().and_then(|r| decode_string(r, 0));
    let sp = load_server_privs(pool, username, host).await?;
    let dp = load_db_privs(pool, username, host).await?;
    Ok(UserModelPayload { username: username.to_string(), host: host.to_string(), plugin: pl, server_privileges: sp, database_privileges: dp })
}

pub fn generate_user_sql_static(current: &UserModel, is_new: bool, original: Option<&UserModel>) -> String {
    let mut sql = String::new();
    let uid = format!("'{}'@'{}'", current.username, current.host);
    let pl = current.plugin.as_deref().unwrap_or("caching_sha2_password");
    let pw = current.password.as_deref().unwrap_or("");
    if is_new {
        sql.push_str("CREATE USER "); sql.push_str(&uid);
        if !pw.is_empty() { sql.push_str(" IDENTIFIED WITH "); sql.push_str(pl); sql.push_str(" BY '"); sql.push_str(&esc(pw)); sql.push_str("'"); }
        sql.push_str(";\n\n");
    } else if let Some(orig) = original {
        if current.username != orig.username || current.host != orig.host {
            let oid = format!("'{}'@'{}'", orig.username, orig.host);
            sql.push_str("RENAME USER "); sql.push_str(&oid); sql.push_str(" TO "); sql.push_str(&uid); sql.push_str(";\n\n");
        }
        if pl != orig.plugin.as_deref().unwrap_or("caching_sha2_password") || !pw.is_empty() {
            sql.push_str("ALTER USER "); sql.push_str(&uid); sql.push_str(" IDENTIFIED WITH "); sql.push_str(pl);
            if !pw.is_empty() { sql.push_str(" BY '"); sql.push_str(&esc(pw)); sql.push_str("'"); }
            sql.push_str(";\n\n");
        }
    }
    gen_priv_sql(&current.username, &current.host, &current.server_privileges, &current.database_privileges, original.map(|o|(&o.server_privileges,&o.database_privileges)), &mut sql);
    sql
}

fn gen_priv_sql(u:&str,h:&str,s:&[String],d:&BTreeMap<String,Vec<String>>,o:Option<(&Vec<String>,&BTreeMap<String,Vec<String>>)>,sql:&mut String) {
    let uid=format!("'{}'@'{}'",u,h);
    let empty_vec = vec![];
    let empty_map = BTreeMap::new();
    let (os,od)=o.unwrap_or((&empty_vec, &empty_map));
    for p in os.iter().filter(|p|!s.contains(p)){sql.push_str(&format!("REVOKE {} ON *.* FROM {};\n",p,uid));}
    for p in s.iter().filter(|p|!os.contains(p)){sql.push_str(&format!("GRANT {} ON *.* TO {};\n",p,uid));}
    for(scope,privs) in d{
        let op=od.get(scope).cloned();
        let tg:Vec<&str>=privs.iter().filter(|p|!op.as_ref().map(|ops|ops.contains(p)).unwrap_or(false)).map(|s|s.as_str()).collect();
        let tr:Vec<&str>=op.as_ref().map(|ops|ops.iter().filter(|p|!privs.contains(p)).map(|s|s.as_str()).collect()).unwrap_or_default();
        if let Some((db,tbl,col))=parse_scope(scope){
            let target=if col!="*"{format!("{}.{}.{}",db,tbl,col)}else if tbl!="*"{format!("{}.{}",db,tbl)}else{format!("{}.*",db)};
            for p in&tr{sql.push_str(&format!("REVOKE {} ON {} FROM {};\n",p,target,uid));}
            for p in&tg{sql.push_str(&format!("GRANT {} ON {} TO {};\n",p,target,uid));}
        }
    }
    if !s.is_empty()||!d.is_empty(){sql.push_str("FLUSH PRIVILEGES;\n");}
}

fn parse_scope(s:&str)->Option<(String,String,String)>{
    let p:Vec<&str>=s.split('.').collect();
    match p.as_slice(){[db]=>Some((db.to_string(),"*".into(),"*".into())),[db,tbl]=>Some((db.to_string(),tbl.to_string(),"*".into())),[db,tbl,col]=>Some((db.to_string(),tbl.to_string(),col.to_string())),_=>None}
}

pub async fn execute_sql(pool: &Pool, sql: &str, db: Option<&str>) -> AppResult<()> {
    use sqlx::Executor;
    // 用 pool.begin() 获取事务连接（专用连接，不跨池）
    let mut tx = pool.begin().await?;

    // 先切换目标库
    if let Some(db) = db {
        let escaped = format!("`{}`", db.replace('`', "``"));
        tx.execute(sqlx::raw_sql(&format!("USE {}", escaped))).await?;
    }

    // DELIMITER 感知切分
    // 使用 MySQL 专用切分器，正确处理 CREATE PROCEDURE/FUNCTION/TRIGGER 的 BEGIN...END 块
    let statements = crate::core::database::mysql::special::split_statements_mysql(sql);

    for s in statements {
        let s = s.trim();
        if s.is_empty() { continue; }
        // raw_sql 简单查询协议
        // CREATE TRIGGER/PROCEDURE/FUNCTION 的 BEGIN...END 复合块在 prepared 协议下触发 MySQL 错误 1295
        tx.execute(sqlx::raw_sql(s)).await?;
    }

    tx.commit().await?;
    Ok(())
}

async fn load_server_privs(pool: &Pool, u: &str, h: &str) -> AppResult<Vec<String>> {
    let sm = server_map();
    let rows = sqlx::query("SELECT * FROM mysql.user WHERE User=? AND Host=?").bind(u).bind(h).fetch_all(pool).await?;
    let mut r = vec![];
    if let Some(row) = rows.first() {
        for (col,dis) in &sm { if let Ok(Some(v)) = row.try_get::<Option<String>,_>(*col) { if v=="Y" { r.push(dis.to_string()); } } }
    }
    let grows = sqlx::query("SELECT Priv FROM mysql.global_grants WHERE User=? AND Host=?").bind(u).bind(h).fetch_all(pool).await?;
    for g in &grows { let pn:String=g.get(0); r.push(cvt_global(&pn).unwrap_or(pn)); }
    Ok(r)
}

async fn load_db_privs(pool: &Pool, u: &str, h: &str) -> AppResult<BTreeMap<String,Vec<String>>> {
    let mut map:BTreeMap<String,Vec<String>>=BTreeMap::new();
    let dm = db_map();
    let drows = sqlx::query("SELECT * FROM mysql.db WHERE User=? AND Host=?").bind(u).bind(h).fetch_all(pool).await?;
    for row in &drows {
        let dn = decode_string(row, "Db");
        if let Some(dn)=dn {
            let scope=format!("{}.*.*",dn);
            for (col,dis) in&dm { if let Ok(Some(v))=row.try_get::<Option<String>,_>(*col) { if v=="Y" { map.entry(scope.clone()).or_default().push(dis.to_string()); } } }
        }
    }
    Ok(map)
}

fn server_map() -> Vec<(&'static str,&'static str)> { vec![("Alter_priv","Alter"),("Alter_routine_priv","Alter Routine"),("Create_priv","Create"),("Create_role_priv","Create Role"),("Create_routine_priv","Create Routine"),("Create_tablespace_priv","Create Tablespace"),("Create_tmp_table_priv","Create Temporary Tables"),("Create_user_priv","Create User"),("Create_view_priv","Create View"),("Delete_priv","Delete"),("Drop_priv","Drop"),("Drop_role_priv","Drop Role"),("Event_priv","Event"),("Execute_priv","Execute"),("File_priv","File"),("Grant_priv","Grant Option"),("Index_priv","Index"),("Insert_priv","Insert"),("Lock_tables_priv","Lock Tables"),("Process_priv","Process"),("References_priv","References"),("Reload_priv","Reload"),("Repl_client_priv","Replication Client"),("Repl_slave_priv","Replication Slave"),("Select_priv","Select"),("Show_db_priv","Show Databases"),("Show_view_priv","Show View"),("Shutdown_priv","Shutdown"),("Super_priv","Super"),("Trigger_priv","Trigger"),("Update_priv","Update")] }
fn db_map() -> Vec<(&'static str,&'static str)> { vec![("Select_priv","Select"),("Insert_priv","Insert"),("Update_priv","Update"),("Delete_priv","Delete"),("Create_priv","Create"),("Drop_priv","Drop"),("Grant_priv","Grant Option"),("References_priv","References"),("Index_priv","Index"),("Alter_priv","Alter"),("Create_tmp_table_priv","Create Temporary Tables"),("Lock_tables_priv","Lock Tables"),("Execute_priv","Execute"),("Create_view_priv","Create View"),("Show_view_priv","Show View"),("Create_routine_priv","Create Routine"),("Alter_routine_priv","Alter Routine"),("Event_priv","Event"),("Trigger_priv","Trigger")] }
fn build_status(l:Option<&str>,e:Option<&str>)->String{
    match(l,e){(Some("Y"),Some("Y"))|(Some("y"),Some("y"))=>"锁定/过期".into(),(Some("Y"),_)|(Some("y"),_)=>"锁定".into(),(_,Some("Y"))|(_,Some("y"))=>"过期".into(),_=>"正常".into()}
}
fn cvt_global(n:&str)->Option<String>{match n{"SYSTEM_USER"=>Some("System User".into()),_=>None}}
fn decode_string<I: sqlx::ColumnIndex<sqlx::mysql::MySqlRow> + Copy>(row: &sqlx::mysql::MySqlRow, idx: I) -> Option<String> {
    if let Ok(s) = row.try_get::<String, _>(idx) {
        return Some(s);
    }
    row.try_get::<Vec<u8>, _>(idx).ok().map(|b| String::from_utf8_lossy(&b).to_string())
}

fn esc(v:&str)->String{v.replace('\\',"\\\\").replace('\'',"''")}
