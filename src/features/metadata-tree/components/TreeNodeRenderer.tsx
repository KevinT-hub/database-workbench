// 树节点渲染器：节点图标与标签的 JSX 构建。
// 从 MetadataTree 拆分而来；useTreeActions（.ts）通过本模块构造节点，
// 保证 JSX 只出现在 .tsx 渲染层。

import React from 'react';
import type { TFunction } from 'i18next';
import type { ConnectionProfile } from '@/types';
import {
  MySqlConnectionIcon,
  DatabaseIcon,
  FolderIcon,
  TableIcon,
  ViewIcon,
  FunctionIcon,
  FieldListIcon,
  KeyIcon,
  IndexIcon,
  ForeignKeyIcon,
  CheckIcon,
  TriggerIcon,
  ParamIcon,
} from '@/components/icons';
import type { TreeNode } from '../treeUtils';

export const buildConnectionIcon = (active: boolean): React.ReactElement => (
  <MySqlConnectionIcon active={active} size={16} />
);

export const buildDatabaseIcon = (opened: boolean, isSystemDb: boolean): React.ReactElement => (
  <DatabaseIcon opened={opened} isSystemDb={isSystemDb} size={16} />
);

const buildFolderIcon = (type: 'table' | 'view' | 'function'): React.ReactElement => (
  <FolderIcon type={type} size={16} />
);

const buildTableIcon = (): React.ReactElement => <TableIcon size={16} />;
const buildViewIcon = (): React.ReactElement => <ViewIcon size={16} />;
const buildFunctionIcon = (): React.ReactElement => <FunctionIcon size={16} />;
const buildFieldListIcon = (): React.ReactElement => <FieldListIcon size={16} />;
const buildIndexIcon = (): React.ReactElement => <IndexIcon size={16} />;
const buildForeignKeyIcon = (): React.ReactElement => <ForeignKeyIcon size={16} />;
const buildCheckIcon = (): React.ReactElement => <CheckIcon size={16} />;
const buildTriggerIcon = (): React.ReactElement => <TriggerIcon size={16} />;
const buildKeyIcon = (keyType: string): React.ReactElement => (
  <KeyIcon size={14} keyType={keyType} />
);
const buildParamIcon = (): React.ReactElement => <ParamIcon size={12} />;

const renderRoutineLabel = (
  name: string,
  routineType?: string,
  returnType?: string,
): string | React.ReactElement => {
  if (routineType === 'FUNCTION' && returnType) {
    return (
      <span>
        {name}
        <span style={{ color: '#2f6fed', marginLeft: 8 }}>{returnType}</span>
      </span>
    );
  }
  return name;
};

const buildParamLabel = (
  param: { name: string; type?: string; mode?: string },
  parentType?: string,
): React.ReactElement => {
  const modeText = parentType === 'PROCEDURE' && param.mode ? `${param.mode} ` : '';
  return (
    <span style={{ color: '#808080' }}>
      {modeText}{param.name}{param.type ? ` : ${param.type}` : ''}
    </span>
  );
};

const getNoParamsText = (t: TFunction): string => {
  return `<${t('metadataTree.noParams')}>`;
};

const buildTableCategoryNodes = (
  baseId: string,
  profile: ConnectionProfile,
  database: string,
  table: string,
  t: TFunction,
): TreeNode[] => {
  return [
    {
      id: `${baseId}-columns`,
      label: t('metadataTree.columns'),
      icon: buildFieldListIcon(),
      isExpanded: false,
      hasCaret: true,
      nodeData: { connection: profile, database, table, folderType: 'columns' },
    },
    {
      id: `${baseId}-indexes`,
      label: t('metadataTree.indexes'),
      icon: buildIndexIcon(),
      isExpanded: false,
      hasCaret: true,
      nodeData: { connection: profile, database, table, folderType: 'indexes' },
    },
    {
      id: `${baseId}-foreign-keys`,
      label: t('metadataTree.foreignKeys'),
      icon: buildForeignKeyIcon(),
      isExpanded: false,
      hasCaret: true,
      nodeData: { connection: profile, database, table, folderType: 'foreignKeys' },
    },
    {
      id: `${baseId}-checks`,
      label: t('metadataTree.checks'),
      icon: buildCheckIcon(),
      isExpanded: false,
      hasCaret: true,
      nodeData: { connection: profile, database, table, folderType: 'checks' },
    },
    {
      id: `${baseId}-triggers`,
      label: t('metadataTree.triggers'),
      icon: buildTriggerIcon(),
      isExpanded: false,
      hasCaret: true,
      nodeData: { connection: profile, database, table, folderType: 'triggers' },
    },
  ];
};

/** 数据库展开后的三个默认文件夹节点（表/视图/函数）。 */
export const buildDatabaseFolderNodes = (
  nodeId: string,
  connection: ConnectionProfile,
  database: string,
  t: TFunction,
): TreeNode[] => {
  return [
    {
      id: `${nodeId}-tables`,
      label: t('metadataTree.tables'),
      icon: buildFolderIcon('table'),
      isExpanded: false,
      hasCaret: true,
      nodeData: { connection, database, folderType: 'tables' },
    },
    {
      id: `${nodeId}-views`,
      label: t('metadataTree.views'),
      icon: buildFolderIcon('view'),
      isExpanded: false,
      hasCaret: true,
      nodeData: { connection, database, folderType: 'views' },
    },
    {
      id: `${nodeId}-functions`,
      label: t('metadataTree.functions'),
      icon: buildFolderIcon('function'),
      isExpanded: false,
      hasCaret: true,
      nodeData: { connection, database, folderType: 'functions' },
    },
  ];
};

interface FolderItemNodeOptions {
  nodeId: string;
  folderType: 'tables' | 'views' | 'functions' | 'columns' | 'indexes' | 'foreignKeys' | 'checks' | 'triggers';
  items: string[];
  routines: Array<{ name: string; type: string; returnType?: string; params: Array<{ name: string; type: string; mode?: string }> }>;
  records: Array<Record<string, string>>;
  connection: ConnectionProfile;
  database: string;
  table?: string;
  t: TFunction;
}

/** 根据已拉取的元数据构建文件夹下的子节点（表/视图/函数/列/索引/外键/检查/触发器）。 */
export const buildFolderItemNodes = (opts: FolderItemNodeOptions): TreeNode[] => {
  const {
    nodeId,
    folderType,
    items,
    routines,
    records,
    connection,
    database,
    table,
    t,
  } = opts;
  let itemNodes: TreeNode[] = [];

  if (folderType === 'tables') {
    if (items.length === 0) {
      itemNodes = [{ id: `${nodeId}-empty`, label: `<${t('metadataTree.noTables')}>`, hasCaret: false }];
    } else {
      itemNodes = items.map(item => {
        const baseId = `${nodeId}-${item}`;
        return {
          id: baseId,
          label: item,
          icon: buildTableIcon(),
          isExpanded: false,
          hasCaret: true,
          childNodes: buildTableCategoryNodes(baseId, connection, database, item, t),
          nodeData: {
            connection,
            database,
            table: item,
            objectName: item,
            itemType: 'table',
          },
        };
      });
    }
  } else if (folderType === 'views') {
    if (items.length === 0) {
      itemNodes = [{ id: `${nodeId}-empty`, label: `<${t('metadataTree.noViews')}>`, hasCaret: false }];
    } else {
      itemNodes = items.map(item => ({
        id: `${nodeId}-${item}`,
        label: item,
        icon: buildViewIcon(),
        hasCaret: false,
        nodeData: { connection, database, objectName: item, itemType: 'view' },
      }));
    }
  } else if (folderType === 'functions') {
    if (routines.length === 0) {
      itemNodes = [{ id: `${nodeId}-empty`, label: `<${t('metadataTree.noFunctions')}>`, hasCaret: false }];
    } else {
      itemNodes = routines.map(routine => {
        const paramNodes: TreeNode[] = routine.params && routine.params.length > 0
          ? routine.params.map((param, index) => ({
              id: `${nodeId}-${routine.name}-param-${index}`,
              label: buildParamLabel(param, routine.type),
              icon: buildParamIcon(),
              hasCaret: false,
              nodeData: { connection, database, itemType: 'param' },
            }))
          : [{
              id: `${nodeId}-${routine.name}-param-none`,
              label: getNoParamsText(t),
              hasCaret: false,
              nodeData: { connection, database, itemType: 'param' },
            }];

        return {
          id: `${nodeId}-${routine.name}`,
          label: renderRoutineLabel(routine.name, routine.type, routine.returnType),
          icon: buildFunctionIcon(),
          isExpanded: false,
          hasCaret: true,
          childNodes: paramNodes,
          nodeData: {
            connection,
            database,
            objectName: routine.name,
            itemType: 'function',
            routineType: routine.type as 'FUNCTION' | 'PROCEDURE',
          },
        };
      });
    }
  } else if (folderType === 'columns') {
    if (records.length === 0) {
      itemNodes = [{ id: `${nodeId}-empty`, label: `<${t('metadataTree.noColumns')}>`, hasCaret: false }];
    } else {
      itemNodes = records.map((record, index) => ({
        id: `${nodeId}-col-${index}`,
        label: `${record.COLUMN_NAME || ''} - ${record.COLUMN_TYPE || ''}`,
        icon: buildKeyIcon(record.COLUMN_KEY || ''),
        hasCaret: false,
        nodeData: {
          connection,
          database,
          table,
          objectName: record.COLUMN_NAME || '',
          itemType: 'column',
        },
      }));
    }
  } else if (folderType === 'indexes') {
    if (records.length === 0) {
      itemNodes = [{ id: `${nodeId}-empty`, label: `<${t('metadataTree.noIndexes')}>`, hasCaret: false }];
    } else {
      itemNodes = records.map((record, index) => {
        const name = record.INDEX_NAME || '';
        const nonUnique = record.NON_UNIQUE || '';
        const cols = record.COLUMNS || '';
        return {
          id: `${nodeId}-idx-${index}`,
          label: `${name}${nonUnique === '0' ? ' (Unique)' : ''} : ${cols}`,
          icon: buildIndexIcon(),
          hasCaret: false,
          nodeData: {
            connection,
            database,
            table,
            objectName: name,
            itemType: 'index',
          },
        };
      });
    }
  } else if (folderType === 'foreignKeys') {
    if (records.length === 0) {
      itemNodes = [{ id: `${nodeId}-empty`, label: `<${t('metadataTree.noForeignKeys')}>`, hasCaret: false }];
    } else {
      itemNodes = records.map((record, index) => ({
        id: `${nodeId}-fk-${index}`,
        label: `${record.CONSTRAINT_NAME || ''} (${record.COLUMN_NAME || ''} -> ${record.REFERENCED_TABLE_NAME || ''}.${record.REFERENCED_COLUMN_NAME || ''})`,
        icon: buildForeignKeyIcon(),
        hasCaret: false,
        nodeData: {
          connection,
          database,
          table,
          objectName: record.CONSTRAINT_NAME || '',
          itemType: 'foreignKey',
        },
      }));
    }
  } else if (folderType === 'checks') {
    if (records.length === 0) {
      itemNodes = [{ id: `${nodeId}-empty`, label: `<${t('metadataTree.noChecks')}>`, hasCaret: false }];
    } else {
      itemNodes = records.map((record, index) => ({
        id: `${nodeId}-check-${index}`,
        label: `${record.CONSTRAINT_NAME || ''}: ${record.CHECK_CLAUSE || ''}`,
        icon: buildCheckIcon(),
        hasCaret: false,
        nodeData: {
          connection,
          database,
          table,
          objectName: record.CONSTRAINT_NAME || '',
          itemType: 'check',
        },
      }));
    }
  } else if (folderType === 'triggers') {
    if (records.length === 0) {
      itemNodes = [{ id: `${nodeId}-empty`, label: `<${t('metadataTree.noTriggers')}>`, hasCaret: false }];
    } else {
      itemNodes = records.map((record, index) => ({
        id: `${nodeId}-trigger-${index}`,
        label: `${record.TRIGGER_NAME || ''} (${record.ACTION_TIMING || ''} ${record.EVENT_MANIPULATION || ''})`,
        icon: buildTriggerIcon(),
        hasCaret: false,
        nodeData: {
          connection,
          database,
          table,
          objectName: record.TRIGGER_NAME || '',
          itemType: 'trigger',
        },
      }));
    }
  }

  return itemNodes;
};
