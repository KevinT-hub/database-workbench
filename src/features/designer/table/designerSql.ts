// 表设计器 SQL 生成（纯函数）：字段定义、CREATE TABLE、ALTER TABLE。
// 与 React 状态解耦，便于测试与复用。

import {
  buildTypeDeclaration,
  isStringType,
  INTEGER_DISPLAY_WIDTH_TYPES,
  TYPE_SUPPORTS_UNSIGNED,
  type CheckDefinition,
  type FieldDefinition,
  type ForeignKeyDefinition,
  type IndexDefinition,
  type TableOptions,
  type TriggerDefinition,
} from './designerTypes';

const buildFieldSqlDefinition = (field: FieldDefinition): string => {
  let def = `\`${field.name}\` ${buildTypeDeclaration(field)}`;

  const normalizedType = field.type.toUpperCase();

  if (field.unsigned && TYPE_SUPPORTS_UNSIGNED.has(normalizedType)) {
    def += ' UNSIGNED';
  }

  if (field.zerofill && INTEGER_DISPLAY_WIDTH_TYPES.has(normalizedType) && field.length.trim()) {
    def += ' ZEROFILL';
  }

  if (field.charset) {
    def += ` CHARACTER SET ${field.charset}`;
  }

  if (field.collation) {
    def += ` COLLATE ${field.collation}`;
  }

  if (!field.nullable) {
    def += ' NOT NULL';
  } else {
    def += ' NULL';
  }

  if (field.defaultValue !== null && field.defaultValue !== undefined) {
    const normalizedDefault = String(field.defaultValue).trim();
    const isNumericLiteral = /^[-+]?\d+(?:\.\d+)?$/.test(normalizedDefault);
    const isBooleanLiteral = /^(true|false)$/i.test(normalizedDefault);
    const isCurrentTimestamp = /^CURRENT_TIMESTAMP(?:\(\d+\))?$/i.test(normalizedDefault);

    if (!normalizedDefault) {
      // Empty input means no default clause.
    } else if (normalizedDefault.toUpperCase() === 'NULL') {
      def += ' DEFAULT NULL';
    } else if (isCurrentTimestamp) {
      def += ` DEFAULT ${normalizedDefault.toUpperCase()}`;
    } else if (isNumericLiteral && !isStringType(normalizedType)) {
      def += ` DEFAULT ${normalizedDefault}`;
    } else if (isBooleanLiteral && ['BOOL', 'BOOLEAN'].includes(normalizedType)) {
      def += ` DEFAULT ${normalizedDefault.toUpperCase()}`;
    } else {
      def += ` DEFAULT '${normalizedDefault.replace(/'/g, "''")}'`;
    }
  }

  if (field.autoIncrement) {
    def += ' AUTO_INCREMENT';
  }

  if (field.comment) {
    def += ` COMMENT '${field.comment.replace(/'/g, "''")}'`;
  }

  return def;
};

interface DesignerSqlInput {
  fields: FieldDefinition[];
  indexes: IndexDefinition[];
  foreignKeys: ForeignKeyDefinition[];
  checks: CheckDefinition[];
  triggers: TriggerDefinition[];
  /** 新建表时是输入框中的表名（可能为空），编辑时等于 currentTableName */
  effectiveTableName: string;
  /** 编辑中的现有表名；新建表为空字符串 */
  currentTableName: string;
  tableOptions: TableOptions;
}

export const generateCreateTableSql = (input: DesignerSqlInput): string => {
  const activeFields = input.fields.filter(f => !f.isDeleted);
  if (activeFields.length === 0) return '';

  const columnDefs = activeFields.map(field => `  ${buildFieldSqlDefinition(field)}`);

  const primaryKeys = activeFields.filter(f => f.isPrimaryKey).map(f => `\`${f.name}\``);
  if (primaryKeys.length > 0) {
    columnDefs.push(`  PRIMARY KEY (${primaryKeys.join(', ')})`);
  }

  const activeIndexes = input.indexes.filter(i => !i.isDeleted);
  activeIndexes.forEach(idx => {
    const uniqueStr = idx.type === 'UNIQUE' ? 'UNIQUE ' : idx.type === 'FULLTEXT' ? 'FULLTEXT ' : idx.type === 'SPATIAL' ? 'SPATIAL ' : '';
    const columns = idx.fields.split(',').map(c => `\`${c.trim()}\``).join(', ');
    columnDefs.push(`  ${uniqueStr}INDEX \`${idx.name}\` (${columns}) USING ${idx.method}`);
  });

  const activeFks = input.foreignKeys.filter(fk => !fk.isDeleted);
  activeFks.forEach(fk => {
    const columns = fk.fields.split(',').map(c => `\`${c.trim()}\``).join(', ');
    const refColumns = fk.refFields.split(',').map(c => `\`${c.trim()}\``).join(', ');
    columnDefs.push(`  CONSTRAINT \`${fk.name}\` FOREIGN KEY (${columns}) REFERENCES \`${fk.refTable}\` (${refColumns}) ON UPDATE ${fk.onUpdate} ON DELETE ${fk.onDelete}`);
  });

  const activeChecks = input.checks.filter(c => !c.isDeleted);
  activeChecks.forEach(chk => {
    const notEnforced = chk.notEnforced ? ' NOT ENFORCED' : '';
    columnDefs.push(`  CONSTRAINT \`${chk.name}\` CHECK (${chk.clause})${notEnforced}`);
  });

  const previewTableName = input.effectiveTableName || 'new_table';

  let sql = `CREATE TABLE \`${previewTableName}\` (\n`;
  sql += columnDefs.join(',\n');
  sql += '\n)';

  sql += ` ENGINE=${input.tableOptions.engine}`;
  if (input.tableOptions.charset) {
    sql += ` DEFAULT CHARSET=${input.tableOptions.charset}`;
  }
  if (input.tableOptions.collation) {
    sql += ` COLLATE=${input.tableOptions.collation}`;
  }
  if (input.tableOptions.autoIncrement) {
    sql += ` AUTO_INCREMENT=${input.tableOptions.autoIncrement}`;
  }
  if (input.tableOptions.comment) {
    sql += ` COMMENT='${input.tableOptions.comment}'`;
  }

  sql += ';';

  // Add triggers
  const activeTriggers = input.triggers.filter(t => !t.isDeleted);
  if (activeTriggers.length > 0) {
    sql += '\n\nDELIMITER ;;';
    activeTriggers.forEach(trg => {
      const events: string[] = [];
      if (trg.insert) events.push('INSERT');
      if (trg.update) events.push('UPDATE');
      if (trg.delete) events.push('DELETE');
      if (events.length > 0) {
        sql += `\nCREATE TRIGGER \`${trg.name}\` ${trg.timing} ${events.join(' OR ')} ON \`${previewTableName}\` FOR EACH ROW ${trg.definition};;`;
      }
    });
    sql += '\nDELIMITER ;';
  }

  return sql;
};

export const generateAlterTableSql = (input: DesignerSqlInput): string => {
  if (!input.currentTableName) {
    return generateCreateTableSql(input);
  }

  const tableName = input.currentTableName;
  const statements: string[] = [];

  input.fields.filter(f => f.isDeleted).forEach(field => {
    statements.push(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${field.originalName || field.name}\`;`);
  });

  input.fields.filter(f => f.isNew && !f.isDeleted).forEach(field => {
    statements.push(`ALTER TABLE \`${tableName}\` ADD COLUMN ${buildFieldSqlDefinition(field)};`);
  });

  input.fields.filter(f => f.isModified && !f.isDeleted && !f.isNew).forEach(field => {
    const originalName = field.originalName || field.name;
    const hasRename = originalName !== field.name;
    if (hasRename) {
      statements.push(
        `ALTER TABLE \`${tableName}\` CHANGE COLUMN \`${originalName}\` ${buildFieldSqlDefinition(field)};`,
      );
    } else {
      statements.push(`ALTER TABLE \`${tableName}\` MODIFY COLUMN ${buildFieldSqlDefinition(field)};`);
    }
  });

  input.indexes.filter(i => i.isDeleted).forEach(idx => {
    statements.push(`ALTER TABLE \`${tableName}\` DROP INDEX \`${idx.originalName || idx.name}\`;`);
  });

  input.indexes.filter(i => i.isNew && !i.isDeleted).forEach(idx => {
    const uniqueStr = idx.type === 'UNIQUE' ? 'UNIQUE ' : idx.type === 'FULLTEXT' ? 'FULLTEXT ' : idx.type === 'SPATIAL' ? 'SPATIAL ' : '';
    const columns = idx.fields.split(',').map(c => `\`${c.trim()}\``).join(', ');
    statements.push(`ALTER TABLE \`${tableName}\` ADD ${uniqueStr}INDEX \`${idx.name}\` (${columns}) USING ${idx.method};`);
  });

  input.indexes.filter(i => i.isModified && !i.isDeleted && !i.isNew).forEach(idx => {
    const originalName = idx.originalName || idx.name;
    statements.push(`ALTER TABLE \`${tableName}\` DROP INDEX \`${originalName}\`;`);
    const uniqueStr = idx.type === 'UNIQUE' ? 'UNIQUE ' : idx.type === 'FULLTEXT' ? 'FULLTEXT ' : idx.type === 'SPATIAL' ? 'SPATIAL ' : '';
    const columns = idx.fields.split(',').map(c => `\`${c.trim()}\``).join(', ');
    statements.push(`ALTER TABLE \`${tableName}\` ADD ${uniqueStr}INDEX \`${idx.name}\` (${columns}) USING ${idx.method};`);
  });

  input.foreignKeys.filter(fk => fk.isDeleted).forEach(fk => {
    statements.push(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${fk.originalName || fk.name}\`;`);
  });

  input.foreignKeys.filter(fk => fk.isNew && !fk.isDeleted).forEach(fk => {
    const columns = fk.fields.split(',').map(c => `\`${c.trim()}\``).join(', ');
    const refColumns = fk.refFields.split(',').map(c => `\`${c.trim()}\``).join(', ');
    statements.push(`ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (${columns}) REFERENCES \`${fk.refTable}\` (${refColumns}) ON UPDATE ${fk.onUpdate} ON DELETE ${fk.onDelete};`);
  });

  input.foreignKeys.filter(fk => fk.isModified && !fk.isDeleted && !fk.isNew).forEach(fk => {
    const originalName = fk.originalName || fk.name;
    statements.push(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${originalName}\`;`);
    const columns = fk.fields.split(',').map(c => `\`${c.trim()}\``).join(', ');
    const refColumns = fk.refFields.split(',').map(c => `\`${c.trim()}\``).join(', ');
    statements.push(`ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (${columns}) REFERENCES \`${fk.refTable}\` (${refColumns}) ON UPDATE ${fk.onUpdate} ON DELETE ${fk.onDelete};`);
  });

  input.checks.filter(c => c.isDeleted).forEach(chk => {
    statements.push(`ALTER TABLE \`${tableName}\` DROP CHECK \`${chk.originalName || chk.name}\`;`);
  });

  input.checks.filter(c => c.isNew && !c.isDeleted).forEach(chk => {
    const notEnforced = chk.notEnforced ? ' NOT ENFORCED' : '';
    statements.push(`ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${chk.name}\` CHECK (${chk.clause})${notEnforced};`);
  });

  input.checks.filter(c => c.isModified && !c.isDeleted && !c.isNew).forEach(chk => {
    const originalName = chk.originalName || chk.name;
    statements.push(`ALTER TABLE \`${tableName}\` DROP CHECK \`${originalName}\`;`);
    const notEnforced = chk.notEnforced ? ' NOT ENFORCED' : '';
    statements.push(`ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${chk.name}\` CHECK (${chk.clause})${notEnforced};`);
  });

  // Triggers are handled separately
  input.triggers.filter(t => t.isDeleted).forEach(trg => {
    statements.push(`DROP TRIGGER IF EXISTS \`${trg.originalName || trg.name}\`;`);
  });

  input.triggers.filter(t => t.isModified && !t.isDeleted && !t.isNew).forEach(trg => {
    const events: string[] = [];
    if (trg.insert) events.push('INSERT');
    if (trg.update) events.push('UPDATE');
    if (trg.delete) events.push('DELETE');
    if (events.length > 0) {
      statements.push(`DROP TRIGGER IF EXISTS \`${trg.originalName || trg.name}\`;`);
      statements.push(`DELIMITER ;;`);
      statements.push(`CREATE TRIGGER \`${trg.name}\` ${trg.timing} ${events.join(' OR ')} ON \`${tableName}\` FOR EACH ROW ${trg.definition};;`);
      statements.push(`DELIMITER ;`);
    }
  });

  input.triggers.filter(t => t.isNew && !t.isDeleted).forEach(trg => {
    const events: string[] = [];
    if (trg.insert) events.push('INSERT');
    if (trg.update) events.push('UPDATE');
    if (trg.delete) events.push('DELETE');
    if (events.length > 0) {
      statements.push(`DELIMITER ;;`);
      statements.push(`CREATE TRIGGER \`${trg.name}\` ${trg.timing} ${events.join(' OR ')} ON \`${tableName}\` FOR EACH ROW ${trg.definition};;`);
      statements.push(`DELIMITER ;`);
    }
  });

  return statements.join('\n\n');
};
