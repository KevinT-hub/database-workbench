// 表设计器数据加载 Hook：从元数据 Store 拉取 DDL/列/索引/外键/检查/触发器，
// 并解析为领域状态（纯加载职责，与变更处理器解耦）。

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMetadataStore } from '@/stores';
import type { ConnectionProfile } from '@/types';
import {
  generateId,
  normalizeFieldForType,
  parseColumnTypeArgs,
  parseEnumSetValues,
  parseTableOptionsFromDdl,
  MYSQL_COLLATIONS,
  type CheckDefinition,
  type FieldDefinition,
  type ForeignKeyDefinition,
  type IndexDefinition,
  type TableOptions,
  type TriggerDefinition,
} from './designerTypes';

interface DesignerLoaderDeps {
  connectionProfile: ConnectionProfile;
  database: string;
  currentTableName: string;
  setDdl: (value: string) => void;
  setFields: React.Dispatch<React.SetStateAction<FieldDefinition[]>>;
  setIndexes: React.Dispatch<React.SetStateAction<IndexDefinition[]>>;
  setForeignKeys: React.Dispatch<React.SetStateAction<ForeignKeyDefinition[]>>;
  setChecks: React.Dispatch<React.SetStateAction<CheckDefinition[]>>;
  setTriggers: React.Dispatch<React.SetStateAction<TriggerDefinition[]>>;
  setTableOptions: React.Dispatch<React.SetStateAction<TableOptions>>;
  setIsLoading: (value: boolean) => void;
  setIsDataReady: (value: boolean) => void;
  setError: (value: string | null) => void;
}

export const useDesignerLoader = (deps: DesignerLoaderDeps) => {
  const { t } = useTranslation();
  const {
    connectionProfile,
    database,
    currentTableName,
    setDdl,
    setFields,
    setIndexes,
    setForeignKeys,
    setChecks,
    setTriggers,
    setTableOptions,
    setIsLoading,
    setIsDataReady,
    setError,
  } = deps;

  const loadTableData = useCallback(async (targetTableName?: string) => {
    if (!connectionProfile || !database) return;

    const tableToLoad = targetTableName ?? currentTableName;

    setIsLoading(true);
    setIsDataReady(false);
    setError(null);

    try {
      if (tableToLoad) {
        const [ddlResult, columnsResult, indexesResult, fksResult, checksResult, triggersResult] = await Promise.all([
          useMetadataStore.getState().loadDdl(connectionProfile, database, tableToLoad),
          useMetadataStore.getState().fetchColumns(connectionProfile, database, tableToLoad),
          useMetadataStore.getState().fetchIndexes(connectionProfile, database, tableToLoad),
          useMetadataStore.getState().fetchForeignKeys(connectionProfile, database, tableToLoad),
          useMetadataStore.getState().fetchChecks(connectionProfile, database, tableToLoad),
          useMetadataStore.getState().fetchTriggers(connectionProfile, database, tableToLoad),
        ]);

        setDdl(ddlResult);

        const parsedFields: FieldDefinition[] = columnsResult.map((col, index) => {
          const parsedArgs = parseColumnTypeArgs(col.COLUMN_TYPE);
          const draftField: FieldDefinition = {
            ...parsedArgs,
            id: generateId(),
            name: col.COLUMN_NAME || '',
            type: (col.DATA_TYPE || '').toUpperCase(),
            enumValues: parseEnumSetValues(col.COLUMN_TYPE, col.DATA_TYPE || ''),
            nullable: col.IS_NULLABLE === 'YES',
            defaultValue: col.COLUMN_DEFAULT,
            comment: col.COLUMN_COMMENT || '',
            isPrimaryKey: col.COLUMN_KEY === 'PRI',
            autoIncrement: col.EXTRA?.includes('auto_increment') || false,
            unsigned: col.COLUMN_TYPE?.includes('unsigned') || false,
            zerofill: col.COLUMN_TYPE?.toLowerCase().includes('zerofill') || false,
            charset: col.CHARACTER_SET_NAME || '',
            collation: col.COLLATION_NAME || '',
            position: index + 1,
            originalName: col.COLUMN_NAME,
            isNew: false,
            isModified: false,
            isDeleted: false,
          };
          return normalizeFieldForType(draftField, draftField.type);
        });
        setFields(parsedFields);

        // Parse indexes - backend returns COLUMNS as comma-separated string
        const parsedIndexes: IndexDefinition[] = indexesResult
          .filter((idx) => idx.INDEX_NAME !== 'PRIMARY')
          .map((idx) => ({
            id: generateId(),
            name: idx.INDEX_NAME || '',
            originalName: idx.INDEX_NAME || '',
            fields: idx.COLUMNS || '',
            type: idx.NON_UNIQUE === '0' ? 'UNIQUE' : 'NORMAL',
            method: (idx.INDEX_TYPE as 'BTREE' | 'HASH') || 'BTREE',
            comment: idx.INDEX_COMMENT || '',
            isNew: false,
            isModified: false,
            isDeleted: false,
          }));
        setIndexes(parsedIndexes);

        // Group foreign keys by name
        const fkMap = new Map<string, ForeignKeyDefinition>();
        fksResult.forEach((fk) => {
          const fkName = fk.CONSTRAINT_NAME || '';

          if (!fkMap.has(fkName)) {
            fkMap.set(fkName, {
              id: generateId(),
              name: fkName,
              originalName: fkName,
              fields: '',
              refSchema: fk.REFERENCED_TABLE_SCHEMA || '',
              refTable: fk.REFERENCED_TABLE_NAME || '',
              refFields: '',
              onUpdate: (fk.UPDATE_RULE || 'RESTRICT') as ForeignKeyDefinition['onUpdate'],
              onDelete: (fk.DELETE_RULE || 'RESTRICT') as ForeignKeyDefinition['onDelete'],
              isNew: false,
              isModified: false,
              isDeleted: false,
            });
          }

          const existing = fkMap.get(fkName)!;
          const colName = fk.COLUMN_NAME || '';
          const refColName = fk.REFERENCED_COLUMN_NAME || '';
          existing.fields = existing.fields ? `${existing.fields},${colName}` : colName;
          existing.refFields = existing.refFields ? `${existing.refFields},${refColName}` : refColName;
        });
        setForeignKeys(Array.from(fkMap.values()));

        const parsedChecks: CheckDefinition[] = checksResult.map((chk) => ({
          id: generateId(),
          name: chk.CONSTRAINT_NAME || '',
          originalName: chk.CONSTRAINT_NAME || '',
          clause: chk.CHECK_CLAUSE || '',
          notEnforced: chk.ENFORCED === 'NO' || !chk.ENFORCED,
          isNew: false,
          isModified: false,
          isDeleted: false,
        }));
        setChecks(parsedChecks);

        // Group triggers by name
        const triggerMap = new Map<string, TriggerDefinition>();
        triggersResult.forEach((trg) => {
          const trgName = trg.TRIGGER_NAME || '';

          if (!triggerMap.has(trgName)) {
            triggerMap.set(trgName, {
              id: generateId(),
              name: trgName,
              originalName: trgName,
              timing: (trg.ACTION_TIMING || 'BEFORE') as TriggerDefinition['timing'],
              insert: false,
              update: false,
              delete: false,
              definition: trg.ACTION_STATEMENT || '',
              isNew: false,
              isModified: false,
              isDeleted: false,
            });
          }

          const existing = triggerMap.get(trgName)!;
          const event = trg.EVENT_MANIPULATION;
          if (event === 'INSERT') existing.insert = true;
          if (event === 'UPDATE') existing.update = true;
          if (event === 'DELETE') existing.delete = true;
        });
        setTriggers(Array.from(triggerMap.values()));

        // 从 DDL 中解析表选项
        const parsedOptions = parseTableOptionsFromDdl(ddlResult);

        const charset = parsedOptions.charset || 'utf8mb4';
        let collation = parsedOptions.collation;
        if (!collation && MYSQL_COLLATIONS[charset]) {
          collation = MYSQL_COLLATIONS[charset][0];
        }

        setTableOptions({
          engine: parsedOptions.engine || 'InnoDB',
          charset,
          collation: collation || 'utf8mb4_0900_ai_ci',
          comment: parsedOptions.comment || '',
          autoIncrement: parsedOptions.autoIncrement || '',
        });
      } else {
        setFields([{
          id: generateId(),
          name: '',
          type: 'INT',
          length: '',
          decimals: '',
          nullable: false,
          defaultValue: null,
          comment: '',
          isPrimaryKey: false,
          autoIncrement: false,
          unsigned: false,
          zerofill: false,
          charset: '',
          collation: '',
          enumValues: '',
          position: 1,
          isNew: true,
          isModified: false,
          isDeleted: false,
        }]);
      }
    } catch (err) {
      setError(t('designerTab.errors.loadFailed', { error: err }));
    } finally {
      setIsLoading(false);
      setIsDataReady(true);
    }
  }, [
    connectionProfile,
    database,
    currentTableName,
    t,
    setDdl,
    setFields,
    setIndexes,
    setForeignKeys,
    setChecks,
    setTriggers,
    setTableOptions,
    setIsLoading,
    setIsDataReady,
    setError,
  ]);

  return {
    loadTableData,
  };
};
