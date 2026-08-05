// 表设计器状态 Hook：领域状态、元数据加载、各 Tab 变更处理器、
// 外部动作请求（右键菜单进入）、SQL 生成与保存。
// 纯渲染与 Monaco 编辑器相关状态留在各 Tab 组件中，保持职责单一。

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Intent, OverlayToaster } from '@blueprintjs/core';
import type { Toaster } from '@blueprintjs/core';
import type { ConnectionProfile, DesignerActionRequest } from '@/types';
import { ddlApi } from '@/api';
import { useAppStore, useTabStore, useMetadataStore } from '@/stores';
import { notifySQLMetadataChanged } from '@/completion';
import {
  generateId,
  normalizeFieldForType,
  sanitizeNumericInput,
  type CheckDefinition,
  type FieldDefinition,
  type ForeignKeyDefinition,
  type IndexDefinition,
  type TableOptions,
  type TriggerDefinition,
} from './designerTypes';
import { generateAlterTableSql, generateCreateTableSql } from './designerSql';
import { useDesignerLoader } from './useDesignerLoader';
import { useDesignerActionRequest } from './useDesignerActionRequest';

let designerToaster: Toaster | null = null;
const getDesignerToaster = async () => {
  if (!designerToaster) {
    designerToaster = await OverlayToaster.create({ position: 'top' });
  }
  return designerToaster;
};

interface UseDesignerStateOptions {
  tabId: string;
  connectionProfile: ConnectionProfile;
  database: string;
  tableName?: string;
  actionRequest?: DesignerActionRequest;
}

export const useDesignerState = ({
  tabId,
  connectionProfile,
  database,
  tableName,
  actionRequest,
}: UseDesignerStateOptions) => {
  const { t } = useTranslation();
  const { updateTab } = useTabStore();
  const { theme: appTheme } = useAppStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTabId, setSelectedTabId] = useState('fields');
  const [isSaving, setIsSaving] = useState(false);

  const [ddl, setDdl] = useState('');
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [indexes, setIndexes] = useState<IndexDefinition[]>([]);
  const [foreignKeys, setForeignKeys] = useState<ForeignKeyDefinition[]>([]);
  const [checks, setChecks] = useState<CheckDefinition[]>([]);
  const [triggers, setTriggers] = useState<TriggerDefinition[]>([]);
  const [tableOptions, setTableOptions] = useState<TableOptions>({
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_0900_ai_ci',
    comment: '',
    autoIncrement: '',
  });

  const [generatedSql, setGeneratedSql] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);

  // Selection states
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedIndexId, setSelectedIndexId] = useState<string | null>(null);
  const [selectedFkId, setSelectedFkId] = useState<string | null>(null);
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);

  const [currentTableName, setCurrentTableName] = useState(tableName || '');
  const isNewTable = !currentTableName;
  const [newTableName, setNewTableName] = useState('');
  const effectiveTableName = isNewTable ? newTableName.trim() : currentTableName;

  const { loadTableData } = useDesignerLoader({
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
  });

  useEffect(() => {
    loadTableData();
  }, [loadTableData]);

  useEffect(() => {
    const hasAnyChanges =
      fields.some(f => f.isNew || f.isModified || f.isDeleted) ||
      indexes.some(i => i.isNew || i.isModified || i.isDeleted) ||
      foreignKeys.some(fk => fk.isNew || fk.isModified || fk.isDeleted) ||
      checks.some(c => c.isNew || c.isModified || c.isDeleted) ||
      triggers.some(trg => trg.isNew || trg.isModified || trg.isDeleted);

    setHasChanges(hasAnyChanges);
  }, [fields, indexes, foreignKeys, checks, triggers, isNewTable]);

  useEffect(() => {
    const sql = isNewTable
      ? generateCreateTableSql({
          fields,
          indexes,
          foreignKeys,
          checks,
          triggers,
          effectiveTableName,
          currentTableName,
          tableOptions,
        })
      : generateAlterTableSql({
          fields,
          indexes,
          foreignKeys,
          checks,
          triggers,
          effectiveTableName,
          currentTableName,
          tableOptions,
        });
    setGeneratedSql(sql);
  }, [isNewTable, fields, indexes, foreignKeys, checks, triggers, effectiveTableName, currentTableName, tableOptions]);

  // ===== Field handlers =====
  const handleFieldChange = (id: string, key: keyof FieldDefinition, value: unknown) => {
    setFields(prev => prev.map(f => {
      if (f.id === id) {
        let updated = { ...f, [key]: value };

        if (key === 'type' && typeof value === 'string') {
          updated = normalizeFieldForType(updated, value);
        }

        if ((key === 'length' || key === 'decimals') && typeof value === 'string') {
          const sanitized = sanitizeNumericInput(value);
          updated = { ...updated, [key]: sanitized };
        }

        if (key === 'length' && typeof updated.length === 'string' && !updated.length.trim()) {
          updated.zerofill = false;
        }

        if (!f.isNew) {
          updated.isModified = true;
        }
        return updated;
      }
      return f;
    }));
  };

  const handleAddField = () => {
    const newPosition = Math.max(...fields.map(f => f.position), 0) + 1;
    const newField: FieldDefinition = {
      id: generateId(),
      name: '',
      type: 'VARCHAR',
      enumValues: '',
      length: '255',
      decimals: '',
      nullable: true,
      defaultValue: null,
      comment: '',
      isPrimaryKey: false,
      autoIncrement: false,
      unsigned: false,
      zerofill: false,
      charset: '',
      collation: '',
      position: newPosition,
      isNew: true,
      isModified: false,
      isDeleted: false,
    };
    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
  };

  const handleInsertField = () => {
    if (!selectedFieldId) {
      handleAddField();
      return;
    }

    const selectedIndex = fields.findIndex(f => f.id === selectedFieldId);
    if (selectedIndex === -1) {
      handleAddField();
      return;
    }

    const newField: FieldDefinition = {
      id: generateId(),
      name: '',
      type: 'VARCHAR',
      enumValues: '',
      length: '255',
      decimals: '',
      nullable: true,
      defaultValue: null,
      comment: '',
      isPrimaryKey: false,
      autoIncrement: false,
      unsigned: false,
      zerofill: false,
      charset: '',
      collation: '',
      position: selectedIndex + 1,
      isNew: true,
      isModified: false,
      isDeleted: false,
    };

    setFields(prev => {
      const newFields = [...prev];
      newFields.splice(selectedIndex, 0, newField);
      // Update positions
      newFields.forEach((f, idx) => f.position = idx + 1);
      return newFields;
    });
    setSelectedFieldId(newField.id);
  };

  const handleDeleteField = () => {
    if (!selectedFieldId) return;

    setFields(prev => {
      const field = prev.find(f => f.id === selectedFieldId);
      if (!field) return prev;

      if (field.isNew) {
        return prev.filter(f => f.id !== selectedFieldId);
      }

      return prev.map(f => {
        if (f.id === selectedFieldId) {
          return { ...f, isDeleted: true };
        }
        return f;
      });
    });
    setSelectedFieldId(null);
  };

  const handleTogglePrimaryKey = () => {
    if (!selectedFieldId) return;

    setFields(prev => prev.map(f => {
      if (f.id === selectedFieldId) {
        const updated = { ...f, isPrimaryKey: !f.isPrimaryKey };
        if (!f.isNew) {
          updated.isModified = true;
        }
        return updated;
      }
      return f;
    }));
  };

  const handleMoveField = (direction: -1 | 1) => {
    if (!selectedFieldId) return;

    setFields(prev => {
      const visibleFields = prev.filter(f => !f.isDeleted);
      const currentIndex = visibleFields.findIndex(f => f.id === selectedFieldId);
      if (currentIndex === -1) return prev;

      const newIndex = currentIndex + direction;
      if (newIndex < 0 || newIndex >= visibleFields.length) return prev;

      // Swap positions
      const temp = visibleFields[currentIndex].position;
      visibleFields[currentIndex].position = visibleFields[newIndex].position;
      visibleFields[newIndex].position = temp;

      // Sort by position
      return [...prev].sort((a, b) => a.position - b.position);
    });
  };

  // ===== Index handlers =====
  const handleIndexChange = (id: string, key: keyof IndexDefinition, value: unknown) => {
    setIndexes(prev => prev.map(i => {
      if (i.id === id) {
        const updated = { ...i, [key]: value };
        if (!i.isNew) {
          updated.isModified = true;
        }
        return updated;
      }
      return i;
    }));
  };

  const handleAddIndex = () => {
    const newIndex: IndexDefinition = {
      id: generateId(),
      name: `idx_${Date.now() % 1000}`,
      fields: '',
      type: 'NORMAL',
      method: 'BTREE',
      comment: '',
      isNew: true,
      isModified: false,
      isDeleted: false,
    };
    setIndexes(prev => [...prev, newIndex]);
    setSelectedIndexId(newIndex.id);
  };

  const handleDeleteIndex = () => {
    if (!selectedIndexId) return;

    setIndexes(prev => {
      const idx = prev.find(i => i.id === selectedIndexId);
      if (!idx) return prev;

      if (idx.isNew) {
        return prev.filter(i => i.id !== selectedIndexId);
      }

      return prev.map(i => {
        if (i.id === selectedIndexId) {
          return { ...i, isDeleted: true };
        }
        return i;
      });
    });
    setSelectedIndexId(null);
  };

  // ===== Foreign Key handlers =====
  const handleFkChange = (id: string, key: keyof ForeignKeyDefinition, value: unknown) => {
    setForeignKeys(prev => prev.map(fk => {
      if (fk.id === id) {
        const updated = { ...fk, [key]: value };
        if (!fk.isNew) {
          updated.isModified = true;
        }
        return updated;
      }
      return fk;
    }));
  };

  const handleAddForeignKey = () => {
    const newFk: ForeignKeyDefinition = {
      id: generateId(),
      name: `fk_${Date.now() % 1000}`,
      fields: '',
      refSchema: '',
      refTable: '',
      refFields: '',
      onUpdate: 'RESTRICT',
      onDelete: 'RESTRICT',
      isNew: true,
      isModified: false,
      isDeleted: false,
    };
    setForeignKeys(prev => [...prev, newFk]);
    setSelectedFkId(newFk.id);
  };

  const handleDeleteForeignKey = () => {
    if (!selectedFkId) return;

    setForeignKeys(prev => {
      const fk = prev.find(f => f.id === selectedFkId);
      if (!fk) return prev;

      if (fk.isNew) {
        return prev.filter(f => f.id !== selectedFkId);
      }

      return prev.map(f => {
        if (f.id === selectedFkId) {
          return { ...f, isDeleted: true };
        }
        return f;
      });
    });
    setSelectedFkId(null);
  };

  // ===== Check handlers =====
  const handleCheckChange = (id: string, key: keyof CheckDefinition, value: unknown) => {
    setChecks(prev => prev.map(c => {
      if (c.id === id) {
        const updated = { ...c, [key]: value };
        if (!c.isNew) {
          updated.isModified = true;
        }
        return updated;
      }
      return c;
    }));
  };

  const handleAddCheck = () => {
    const newCheck: CheckDefinition = {
      id: generateId(),
      name: `chk_${Date.now() % 1000}`,
      clause: '',
      notEnforced: false,
      isNew: true,
      isModified: false,
      isDeleted: false,
    };
    setChecks(prev => [...prev, newCheck]);
    setSelectedCheckId(newCheck.id);
  };

  const handleDeleteCheck = () => {
    if (!selectedCheckId) return;

    setChecks(prev => {
      const chk = prev.find(c => c.id === selectedCheckId);
      if (!chk) return prev;

      if (chk.isNew) {
        return prev.filter(c => c.id !== selectedCheckId);
      }

      return prev.map(c => {
        if (c.id === selectedCheckId) {
          return { ...c, isDeleted: true };
        }
        return c;
      });
    });
    setSelectedCheckId(null);
  };

  // ===== Trigger handlers =====
  const handleTriggerChange = (id: string, key: keyof TriggerDefinition, value: unknown) => {
    setTriggers(prev => prev.map(trg => {
      if (trg.id === id) {
        const updated = { ...trg, [key]: value };
        if (!trg.isNew) {
          updated.isModified = true;
        }
        return updated;
      }
      return trg;
    }));
  };

  const handleAddTrigger = () => {
    const newTrigger: TriggerDefinition = {
      id: generateId(),
      name: `trg_${Date.now() % 1000}`,
      timing: 'BEFORE',
      insert: false,
      update: false,
      delete: false,
      definition: '',
      isNew: true,
      isModified: false,
      isDeleted: false,
    };
    setTriggers(prev => [...prev, newTrigger]);
    setSelectedTriggerId(newTrigger.id);
  };

  const handleDeleteTrigger = () => {
    if (!selectedTriggerId) return;

    setTriggers(prev => {
      const trg = prev.find(trgItem => trgItem.id === selectedTriggerId);
      if (!trg) return prev;

      if (trg.isNew) {
        return prev.filter(trgItem => trgItem.id !== selectedTriggerId);
      }

      return prev.map(trgItem => {
        if (trgItem.id === selectedTriggerId) {
          return { ...trgItem, isDeleted: true };
        }
        return trgItem;
      });
    });
    setSelectedTriggerId(null);
  };

  // ===== 外部动作请求（元数据树右键菜单进入） =====
  useDesignerActionRequest({
    actionRequest,
    isLoading,
    isDataReady,
    setSelectedTabId,
    fields,
    indexes,
    foreignKeys,
    checks,
    triggers,
    setFields,
    setIndexes,
    setForeignKeys,
    setChecks,
    setTriggers,
    handleAddField,
    handleAddIndex,
    handleAddForeignKey,
    handleAddCheck,
    handleAddTrigger,
    handleFieldChange,
    handleIndexChange,
    handleFkChange,
    handleCheckChange,
    handleTriggerChange,
    setSelectedFieldId,
    setSelectedIndexId,
    setSelectedFkId,
    setSelectedCheckId,
    setSelectedTriggerId,
  });
  const handleSave = async () => {
    if (isNewTable && !effectiveTableName) {
      setError(t('designerTab.errors.noTableName'));
      return;
    }

    if (!generatedSql) return;

    setIsSaving(true);
    try {
      await ddlApi.executeSql(connectionProfile, generatedSql, database);
      useMetadataStore.getState().invalidate(connectionProfile, database);
      setHasChanges(false);
      if (isNewTable) {
        setCurrentTableName(effectiveTableName);
        updateTab(tabId, {
          title: t('designerTab.tabTitle', { name: effectiveTableName }),
          table: effectiveTableName,
        });
        await loadTableData(effectiveTableName);
        setSelectedTabId('ddl');
      } else {
        await loadTableData();
      }
      (await getDesignerToaster())?.show({
        message: isNewTable ? t('designerTab.saveSuccess.create', { name: effectiveTableName }) : t('designerTab.saveSuccess.modify', { name: currentTableName }),
        intent: Intent.SUCCESS,
        timeout: 3000,
      });
      notifySQLMetadataChanged({
        source: 'table-designer',
        profile: connectionProfile,
        databases: [database],
        tableName: effectiveTableName || currentTableName,
        action: isNewTable ? 'create' : 'alter',
      });
    } catch (err) {
      setError(t('designerTab.errors.saveFailed', { error: err }));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    appTheme,
    isLoading,
    error,
    setError,
    selectedTabId,
    setSelectedTabId,
    isSaving,
    ddl,
    fields,
    indexes,
    foreignKeys,
    checks,
    triggers,
    tableOptions,
    setTableOptions,
    generatedSql,
    hasChanges,
    selectedFieldId,
    setSelectedFieldId,
    selectedIndexId,
    setSelectedIndexId,
    selectedFkId,
    setSelectedFkId,
    selectedCheckId,
    setSelectedCheckId,
    selectedTriggerId,
    setSelectedTriggerId,
    currentTableName,
    isNewTable,
    newTableName,
    setNewTableName,
    effectiveTableName,
    loadTableData,
    handleSave,
    handleFieldChange,
    handleAddField,
    handleInsertField,
    handleDeleteField,
    handleTogglePrimaryKey,
    handleMoveField,
    handleIndexChange,
    handleAddIndex,
    handleDeleteIndex,
    handleFkChange,
    handleAddForeignKey,
    handleDeleteForeignKey,
    handleCheckChange,
    handleAddCheck,
    handleDeleteCheck,
    handleTriggerChange,
    handleAddTrigger,
    handleDeleteTrigger,
  };
};

