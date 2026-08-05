// 表设计器外部动作请求 Hook：消费元数据树右键菜单下发的
// DesignerActionRequest（新增/编辑/删除/重命名），切换 Tab 并选中目标对象。

import { useEffect, useRef } from 'react';
import type React from 'react';
import type { DesignerActionRequest } from '@/types';
import type {
  CheckDefinition,
  FieldDefinition,
  ForeignKeyDefinition,
  IndexDefinition,
  TriggerDefinition,
} from './designerTypes';

interface DesignerActionRequestDeps {
  actionRequest?: DesignerActionRequest;
  isLoading: boolean;
  isDataReady: boolean;
  setSelectedTabId: (id: string) => void;
  fields: FieldDefinition[];
  indexes: IndexDefinition[];
  foreignKeys: ForeignKeyDefinition[];
  checks: CheckDefinition[];
  triggers: TriggerDefinition[];
  setFields: React.Dispatch<React.SetStateAction<FieldDefinition[]>>;
  setIndexes: React.Dispatch<React.SetStateAction<IndexDefinition[]>>;
  setForeignKeys: React.Dispatch<React.SetStateAction<ForeignKeyDefinition[]>>;
  setChecks: React.Dispatch<React.SetStateAction<CheckDefinition[]>>;
  setTriggers: React.Dispatch<React.SetStateAction<TriggerDefinition[]>>;
  handleAddField: () => void;
  handleAddIndex: () => void;
  handleAddForeignKey: () => void;
  handleAddCheck: () => void;
  handleAddTrigger: () => void;
  handleFieldChange: (id: string, key: keyof FieldDefinition, value: unknown) => void;
  handleIndexChange: (id: string, key: keyof IndexDefinition, value: unknown) => void;
  handleFkChange: (id: string, key: keyof ForeignKeyDefinition, value: unknown) => void;
  handleCheckChange: (id: string, key: keyof CheckDefinition, value: unknown) => void;
  handleTriggerChange: (id: string, key: keyof TriggerDefinition, value: unknown) => void;
  setSelectedFieldId: (id: string | null) => void;
  setSelectedIndexId: (id: string | null) => void;
  setSelectedFkId: (id: string | null) => void;
  setSelectedCheckId: (id: string | null) => void;
  setSelectedTriggerId: (id: string | null) => void;
}

export const useDesignerActionRequest = (deps: DesignerActionRequestDeps) => {
  const {
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
  } = deps;

  const lastAppliedActionNonceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!actionRequest) return;
    if (isLoading || !isDataReady) return;
    if (lastAppliedActionNonceRef.current === actionRequest.nonce) return;

    let applied = false;

    const findByName = <T extends { id: string; name: string; isDeleted?: boolean }>(
      items: T[],
      name?: string,
    ): T | undefined => {
      if (!name) return undefined;
      return items.find((item) => !item.isDeleted && item.name === name);
    };

    const applyRename = (
      targetName: string | undefined,
      nextName: string | undefined,
      update: (id: string, value: string) => void,
      select: (id: string | null) => void,
      candidates: Array<{ id: string; name: string; isDeleted?: boolean }>,
    ) => {
      if (!targetName || !nextName) return false;
      const item = findByName(candidates, targetName);
      if (!item) return false;
      update(item.id, nextName);
      select(item.id);
      return true;
    };

    if (actionRequest.target === 'field') {
      setSelectedTabId('fields');
      if (actionRequest.action === 'new') {
        handleAddField();
        applied = true;
        lastAppliedActionNonceRef.current = actionRequest.nonce;
        return;
      }

      const field = findByName(fields, actionRequest.name);
      if (!field) return;

      if (actionRequest.action === 'edit') {
        setSelectedFieldId(field.id);
        applied = true;
        lastAppliedActionNonceRef.current = actionRequest.nonce;
        return;
      }

      if (actionRequest.action === 'delete') {
        setFields((prev) =>
          prev.map((item) =>
            item.id === field.id
              ? (item.isNew ? { ...item, isDeleted: true } : { ...item, isDeleted: true, isModified: true })
              : item,
          ),
        );
        setSelectedFieldId(field.id);
        applied = true;
        lastAppliedActionNonceRef.current = actionRequest.nonce;
        return;
      }

      if (actionRequest.action === 'rename') {
        applied = applyRename(
          actionRequest.name,
          actionRequest.newName,
          (id, value) => handleFieldChange(id, 'name', value),
          setSelectedFieldId,
          fields,
        );
      }
      if (applied) {
        lastAppliedActionNonceRef.current = actionRequest.nonce;
      }
      return;
    }

    if (actionRequest.target === 'index') {
      setSelectedTabId('indexes');
      if (actionRequest.action === 'new') {
        handleAddIndex();
        applied = true;
        lastAppliedActionNonceRef.current = actionRequest.nonce;
        return;
      }

      const index = findByName(indexes, actionRequest.name);
      if (!index) return;
      if (actionRequest.action === 'edit') {
        setSelectedIndexId(index.id);
        applied = true;
        lastAppliedActionNonceRef.current = actionRequest.nonce;
        return;
      }
      if (actionRequest.action === 'delete') {
        setIndexes((prev) => prev.map((item) => (item.id === index.id ? { ...item, isDeleted: true, isModified: true } : item)));
        setSelectedIndexId(index.id);
        applied = true;
        lastAppliedActionNonceRef.current = actionRequest.nonce;
        return;
      }
      if (actionRequest.action === 'rename') {
        applied = applyRename(
          actionRequest.name,
          actionRequest.newName,
          (id, value) => handleIndexChange(id, 'name', value),
          setSelectedIndexId,
          indexes,
        );
      }
      if (applied) {
        lastAppliedActionNonceRef.current = actionRequest.nonce;
      }
      return;
    }

    if (actionRequest.target === 'foreignKey') {
      setSelectedTabId('foreignKeys');
      if (actionRequest.action === 'new') {
        handleAddForeignKey();
        applied = true;
        lastAppliedActionNonceRef.current = actionRequest.nonce;
        return;
      }

      const fk = findByName(foreignKeys, actionRequest.name);
      if (!fk) return;
      if (actionRequest.action === 'edit') {
        setSelectedFkId(fk.id);
        applied = true;
        lastAppliedActionNonceRef.current = actionRequest.nonce;
        return;
      }
      if (actionRequest.action === 'delete') {
        setForeignKeys((prev) => prev.map((item) => (item.id === fk.id ? { ...item, isDeleted: true, isModified: true } : item)));
        setSelectedFkId(fk.id);
        applied = true;
        lastAppliedActionNonceRef.current = actionRequest.nonce;
        return;
      }
      if (actionRequest.action === 'rename') {
        applied = applyRename(
          actionRequest.name,
          actionRequest.newName,
          (id, value) => handleFkChange(id, 'name', value),
          setSelectedFkId,
          foreignKeys,
        );
      }
      if (applied) {
        lastAppliedActionNonceRef.current = actionRequest.nonce;
      }
      return;
    }

    if (actionRequest.target === 'check') {
      setSelectedTabId('checks');
      if (actionRequest.action === 'new') {
        handleAddCheck();
        applied = true;
        lastAppliedActionNonceRef.current = actionRequest.nonce;
        return;
      }

      const chk = findByName(checks, actionRequest.name);
      if (!chk) return;
      if (actionRequest.action === 'edit') {
        setSelectedCheckId(chk.id);
        applied = true;
        lastAppliedActionNonceRef.current = actionRequest.nonce;
        return;
      }
      if (actionRequest.action === 'delete') {
        setChecks((prev) => prev.map((item) => (item.id === chk.id ? { ...item, isDeleted: true, isModified: true } : item)));
        setSelectedCheckId(chk.id);
        applied = true;
        lastAppliedActionNonceRef.current = actionRequest.nonce;
        return;
      }
      if (actionRequest.action === 'rename') {
        applied = applyRename(
          actionRequest.name,
          actionRequest.newName,
          (id, value) => handleCheckChange(id, 'name', value),
          setSelectedCheckId,
          checks,
        );
      }
      if (applied) {
        lastAppliedActionNonceRef.current = actionRequest.nonce;
      }
      return;
    }

    if (actionRequest.target === 'trigger') {
      setSelectedTabId('triggers');
      if (actionRequest.action === 'new') {
        handleAddTrigger();
        applied = true;
        lastAppliedActionNonceRef.current = actionRequest.nonce;
        return;
      }

      const trg = findByName(triggers, actionRequest.name);
      if (!trg) return;
      if (actionRequest.action === 'edit') {
        setSelectedTriggerId(trg.id);
        applied = true;
        lastAppliedActionNonceRef.current = actionRequest.nonce;
        return;
      }
      if (actionRequest.action === 'delete') {
        setTriggers((prev) => prev.map((item) => (item.id === trg.id ? { ...item, isDeleted: true, isModified: true } : item)));
        setSelectedTriggerId(trg.id);
        applied = true;
        lastAppliedActionNonceRef.current = actionRequest.nonce;
        return;
      }
      if (actionRequest.action === 'rename') {
        applied = applyRename(
          actionRequest.name,
          actionRequest.newName,
          (id, value) => handleTriggerChange(id, 'name', value),
          setSelectedTriggerId,
          triggers,
        );
      }
    }

    if (applied) {
      lastAppliedActionNonceRef.current = actionRequest.nonce;
    }
  }, [
    actionRequest,
    checks,
    fields,
    foreignKeys,
    handleAddCheck,
    handleAddField,
    handleAddForeignKey,
    handleAddIndex,
    handleAddTrigger,
    handleCheckChange,
    handleFieldChange,
    handleFkChange,
    handleIndexChange,
    handleTriggerChange,
    isDataReady,
    indexes,
    isLoading,
    setChecks,
    setFields,
    setForeignKeys,
    setIndexes,
    setSelectedCheckId,
    setSelectedFieldId,
    setSelectedFkId,
    setSelectedIndexId,
    setSelectedTabId,
    setSelectedTriggerId,
    setTriggers,
    triggers,
  ]);
};
