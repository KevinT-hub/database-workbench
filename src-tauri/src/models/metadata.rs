use serde::{Deserialize, Serialize};

// 保留 PascalCase：字段对应 INFORMATION_SCHEMA 列名
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableDetail {
    #[serde(rename = "Name")]
    pub name: String,
    #[serde(rename = "Rows")]
    pub rows: Option<u64>,
    #[serde(rename = "DataLength")]
    pub data_length: Option<u64>,
    #[serde(rename = "Engine")]
    pub engine: Option<String>,
    #[serde(rename = "UpdateTime")]
    pub update_time: Option<String>,
    #[serde(rename = "Comment")]
    pub comment: Option<String>,
}

// 保留 PascalCase：字段对应 INFORMATION_SCHEMA 列名
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewDetail {
    #[serde(rename = "Name")]
    pub name: String,
    #[serde(rename = "Definition")]
    pub definition: Option<String>,
    #[serde(rename = "CheckOption")]
    pub check_option: Option<String>,
    #[serde(rename = "IsUpdatable")]
    pub is_updatable: Option<String>,
    #[serde(rename = "Definer")]
    pub definer: Option<String>,
    #[serde(rename = "SecurityType")]
    pub security_type: Option<String>,
    #[serde(rename = "CreateTime")]
    pub create_time: Option<String>,
    #[serde(rename = "UpdateTime")]
    pub update_time: Option<String>,
}

// 保留 PascalCase：字段对应 INFORMATION_SCHEMA 列名
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionDetail {
    #[serde(rename = "Name")]
    pub name: String,
    #[serde(rename = "Type")]
    pub routine_type: String,
    #[serde(rename = "DataType")]
    pub data_type: Option<String>,
    #[serde(rename = "Definition")]
    pub definition: Option<String>,
    #[serde(rename = "IsDeterministic")]
    pub is_deterministic: Option<String>,
    #[serde(rename = "SqlDataAccess")]
    pub sql_data_access: Option<String>,
    #[serde(rename = "SecurityType")]
    pub security_type: Option<String>,
    #[serde(rename = "Definer")]
    pub definer: Option<String>,
    #[serde(rename = "CreateTime")]
    pub create_time: Option<String>,
    #[serde(rename = "UpdateTime")]
    pub update_time: Option<String>,
    #[serde(rename = "Comment")]
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutineParam {
    pub name: String,
    #[serde(rename = "type")]
    pub param_type: String,
    pub mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutineDetail {
    pub name: String,
    #[serde(rename = "type")]
    pub routine_type: String,
    #[serde(rename = "returnType")]
    pub return_type: Option<String>,
    pub params: Vec<RoutineParam>,
}

/// 列信息 —— 序列化为大写列名，与 INFORMATION_SCHEMA.COLUMNS 列名一致，
/// 前端通过 `record.COLUMN_NAME` 等大写键访问。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    #[serde(rename = "COLUMN_NAME")]
    pub name: String,
    #[serde(rename = "DATA_TYPE")]
    pub data_type: String,
    #[serde(rename = "COLUMN_TYPE")]
    pub column_type: String,
    #[serde(rename = "IS_NULLABLE")]
    pub is_nullable: String,
    #[serde(rename = "COLUMN_DEFAULT")]
    pub column_default: Option<String>,
    #[serde(rename = "COLUMN_KEY")]
    pub column_key: String,
    #[serde(rename = "EXTRA")]
    pub extra: String,
    #[serde(rename = "CHARACTER_MAXIMUM_LENGTH")]
    pub char_max_length: Option<String>,
    #[serde(rename = "NUMERIC_PRECISION")]
    pub numeric_precision: Option<String>,
    #[serde(rename = "NUMERIC_SCALE")]
    pub numeric_scale: Option<String>,
    #[serde(rename = "COLUMN_COMMENT")]
    pub column_comment: String,
    #[serde(rename = "CHARACTER_SET_NAME")]
    pub charset: Option<String>,
    #[serde(rename = "COLLATION_NAME")]
    pub collation: Option<String>,
}

/// 索引信息 —— 序列化为大写列名，前端通过 `record.INDEX_NAME` 等访问。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexInfo {
    #[serde(rename = "INDEX_NAME")]
    pub name: String,
    #[serde(rename = "NON_UNIQUE")]
    pub non_unique: String,
    #[serde(rename = "COLUMNS")]
    pub columns: String,
    #[serde(rename = "INDEX_TYPE")]
    pub index_type: String,
}

/// 外键信息 —— 序列化为大写列名，前端通过 `record.COLUMN_NAME` 等访问。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForeignKeyInfo {
    #[serde(rename = "COLUMN_NAME")]
    pub column_name: String,
    #[serde(rename = "REFERENCED_TABLE_SCHEMA")]
    pub ref_schema: String,
    #[serde(rename = "REFERENCED_TABLE_NAME")]
    pub ref_table: String,
    #[serde(rename = "REFERENCED_COLUMN_NAME")]
    pub ref_column: String,
    #[serde(rename = "CONSTRAINT_NAME")]
    pub constraint_name: String,
}

/// 触发器信息 —— 序列化为大写列名，前端通过 `record.TRIGGER_NAME` 等访问。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerInfo {
    #[serde(rename = "TRIGGER_NAME")]
    pub name: String,
    #[serde(rename = "ACTION_TIMING")]
    pub timing: String,
    #[serde(rename = "EVENT_MANIPULATION")]
    pub event: String,
    #[serde(rename = "ACTION_STATEMENT")]
    pub statement: String,
}

/// 检查约束信息 —— 序列化为大写列名，前端通过 `record.CONSTRAINT_NAME` 等访问。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckInfo {
    #[serde(rename = "CONSTRAINT_NAME")]
    pub name: String,
    #[serde(rename = "CHECK_CLAUSE")]
    pub clause: String,
    #[serde(rename = "ENFORCED")]
    pub enforced: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableDesign {
    pub name: String,
    pub columns: Vec<ColumnInfo>,
}
