// 表设计器领域模型与常量：字段/索引/外键/检查/触发器/表选项的定义、
// MySQL 类型/引擎/字符集常量，以及类型参数的纯解析与归一化工具。

export interface FieldDefinition {
  id: string;
  name: string;
  type: string;
  enumValues: string;
  length: string;
  decimals: string;
  nullable: boolean;
  defaultValue: string | null;
  comment: string;
  isPrimaryKey: boolean;
  autoIncrement: boolean;
  unsigned: boolean;
  zerofill: boolean;
  charset: string;
  collation: string;
  position: number;
  originalName?: string;
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

export interface IndexDefinition {
  id: string;
  name: string;
  originalName?: string;
  fields: string;
  type: 'NORMAL' | 'UNIQUE' | 'FULLTEXT' | 'SPATIAL';
  method: 'BTREE' | 'HASH';
  comment: string;
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

export interface ForeignKeyDefinition {
  id: string;
  name: string;
  originalName?: string;
  fields: string;
  refSchema: string;
  refTable: string;
  refFields: string;
  onUpdate: 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'NO ACTION';
  onDelete: 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'NO ACTION';
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

export interface CheckDefinition {
  id: string;
  name: string;
  originalName?: string;
  clause: string;
  notEnforced: boolean;
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

export interface TriggerDefinition {
  id: string;
  name: string;
  originalName?: string;
  timing: 'BEFORE' | 'AFTER';
  insert: boolean;
  update: boolean;
  delete: boolean;
  definition: string;
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

export interface TableOptions {
  engine: string;
  charset: string;
  collation: string;
  comment: string;
  autoIncrement: string;
}

export const MYSQL_DATA_TYPES = [
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT',
  'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE',
  'CHAR', 'VARCHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT',
  'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB', 'BINARY', 'VARBINARY',
  'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR',
  'BOOLEAN', 'BOOL',
  'ENUM', 'SET',
  'JSON',
  'BIT',
];

export const MYSQL_ENGINES = ['InnoDB', 'MyISAM', 'MEMORY', 'CSV', 'ARCHIVE', 'BLACKHOLE', 'MERGE', 'FEDERATED'];

export const MYSQL_CHARSETS = ['utf8mb4', 'utf8', 'latin1', 'gbk', 'gb2312', 'big5', 'ascii', 'binary'];

export const MYSQL_COLLATIONS: Record<string, string[]> = {
  'utf8mb4': ['utf8mb4_0900_ai_ci', 'utf8mb4_0900_as_ci', 'utf8mb4_0900_as_cs', 'utf8mb4_unicode_ci', 'utf8mb4_general_ci', 'utf8mb4_bin'],
  'utf8': ['utf8_general_ci', 'utf8_unicode_ci', 'utf8_bin'],
  'latin1': ['latin1_swedish_ci', 'latin1_general_ci', 'latin1_bin'],
  'gbk': ['gbk_chinese_ci', 'gbk_bin'],
  'gb2312': ['gb2312_chinese_ci', 'gb2312_bin'],
  'big5': ['big5_chinese_ci', 'big5_bin'],
  'ascii': ['ascii_general_ci', 'ascii_bin'],
  'binary': ['binary'],
};

export const INDEX_TYPES = ['NORMAL', 'UNIQUE', 'FULLTEXT', 'SPATIAL'];

export const INDEX_METHODS = ['BTREE', 'HASH'];

export const FK_ACTIONS = ['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION'];

export const TRIGGER_TIMINGS = ['BEFORE', 'AFTER'];

const STRING_DATA_TYPES = ['CHAR', 'VARCHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT', 'BINARY', 'VARBINARY', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB', 'ENUM', 'SET'];

export const INTEGER_DISPLAY_WIDTH_TYPES = new Set([
  'TINYINT',
  'SMALLINT',
  'MEDIUMINT',
  'INT',
  'INTEGER',
  'BIGINT',
]);

export const TYPE_SUPPORTS_UNSIGNED = new Set([
  'TINYINT',
  'SMALLINT',
  'MEDIUMINT',
  'INT',
  'INTEGER',
  'BIGINT',
  'DECIMAL',
  'NUMERIC',
  'FLOAT',
  'DOUBLE',
]);

export const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/** 从 DDL 中解析表选项（引擎/字符集/排序规则/注释/自增值）。 */
export const parseTableOptionsFromDdl = (ddl: string): Partial<TableOptions> => {
  const options: Partial<TableOptions> = {};
  if (!ddl) return options;

  const engineMatch = ddl.match(/ENGINE\s*=\s*(\w+)/i);
  if (engineMatch) {
    options.engine = engineMatch[1];
  }

  const charsetMatch = ddl.match(/CHARSET\s*=\s*(\w+)/i) || ddl.match(/CHARACTER\s+SET\s*=\s*(\w+)/i);
  if (charsetMatch) {
    options.charset = charsetMatch[1];
  }

  const collationMatch = ddl.match(/COLLATE\s*=\s*(\w+)/i);
  if (collationMatch) {
    options.collation = collationMatch[1];
  }

  const commentMatch = ddl.match(/COMMENT\s*=\s*['"]([^'"]*)['"]/i);
  if (commentMatch) {
    options.comment = commentMatch[1];
  }

  const autoIncrementMatch = ddl.match(/AUTO_INCREMENT\s*=\s*(\d+)/i);
  if (autoIncrementMatch) {
    options.autoIncrement = autoIncrementMatch[1];
  }

  return options;
};

type TypeParameterMode = 'none' | 'single' | 'double';

export const getTypeParameterMode = (type: string): TypeParameterMode => {
  const normalizedType = type.toUpperCase();

  if (['DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE'].includes(normalizedType)) {
    return 'double';
  }

  if (
    [
      'TINYINT',
      'SMALLINT',
      'MEDIUMINT',
      'INT',
      'INTEGER',
      'BIGINT',
      'BIT',
      'CHAR',
      'VARCHAR',
      'BINARY',
      'VARBINARY',
      'TEXT',
      'BLOB',
      'TIME',
      'DATETIME',
      'TIMESTAMP',
    ].includes(normalizedType)
  ) {
    return 'single';
  }

  return 'none';
};

export const sanitizeNumericInput = (input: string): string => input.replace(/[^0-9]/g, '');

export const parseColumnTypeArgs = (columnType: string | undefined): { length: string; decimals: string } => {
  if (!columnType) return { length: '', decimals: '' };

  const match = columnType.match(/\((\d+)(?:\s*,\s*(\d+))?\)/);
  if (!match) {
    return { length: '', decimals: '' };
  }

  return {
    length: match[1] || '',
    decimals: match[2] || '',
  };
};

export const parseEnumSetValues = (columnType: string | undefined, dataType: string): string => {
  if (!columnType) return '';
  const normalizedType = dataType.toUpperCase();
  if (!['ENUM', 'SET'].includes(normalizedType)) return '';

  const match = columnType.match(/^[a-zA-Z]+\((.*)\)$/);
  if (!match || !match[1]) return '';
  return match[1].trim();
};

export const isStringType = (type: string): boolean => {
  return STRING_DATA_TYPES.includes(type.toUpperCase());
};

/** 切换字段类型时按新类型归一化长度/小数位/无符号/零填充/字符集等属性。 */
export const normalizeFieldForType = (field: FieldDefinition, nextType: string): FieldDefinition => {
  const normalizedType = nextType.toUpperCase();
  const mode = getTypeParameterMode(normalizedType);

  const normalized: FieldDefinition = {
    ...field,
    type: normalizedType,
  };

  if (mode === 'none') {
    normalized.length = '';
    normalized.decimals = '';
  } else if (mode === 'single') {
    normalized.decimals = '';
  }

  if (!TYPE_SUPPORTS_UNSIGNED.has(normalizedType)) {
    normalized.unsigned = false;
  }

  if (!INTEGER_DISPLAY_WIDTH_TYPES.has(normalizedType)) {
    normalized.zerofill = false;
  }

  if (!isStringType(normalizedType)) {
    normalized.charset = '';
    normalized.collation = '';
  }

  if (['ENUM', 'SET'].includes(normalizedType) && !normalized.enumValues.trim()) {
    normalized.enumValues = `'value1'`;
  }

  if (!['ENUM', 'SET'].includes(normalizedType)) {
    normalized.enumValues = '';
  }

  return normalized;
};

/** 构建字段的类型声明片段（含 ENUM/SET 值、长度、小数位）。 */
export const buildTypeDeclaration = (field: FieldDefinition): string => {
  const normalizedType = field.type.toUpperCase();
  if (['ENUM', 'SET'].includes(normalizedType)) {
    const rawValues = field.enumValues.trim();
    if (!rawValues) {
      return normalizedType;
    }
    const compactValues = rawValues.startsWith('(') && rawValues.endsWith(')')
      ? rawValues.slice(1, -1).trim()
      : rawValues;
    return `${normalizedType}(${compactValues})`;
  }

  const mode = getTypeParameterMode(normalizedType);
  const length = field.length.trim();
  const decimals = field.decimals.trim();

  if (mode === 'double') {
    if (length && decimals) {
      return `${normalizedType}(${length},${decimals})`;
    }
    if (length) {
      return `${normalizedType}(${length})`;
    }
    return normalizedType;
  }

  if (mode === 'single' && length) {
    return `${normalizedType}(${length})`;
  }

  return normalizedType;
};
