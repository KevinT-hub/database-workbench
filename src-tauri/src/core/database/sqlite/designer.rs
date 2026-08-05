use crate::models::metadata::*;

pub fn generate_create_table_sql(_design: &TableDesign) -> String { unimplemented!("SQLite DDL generation") }
pub fn generate_alter_table_sql(_original: &TableDesign, _modified: &TableDesign) -> String { unimplemented!("SQLite DDL generation") }
