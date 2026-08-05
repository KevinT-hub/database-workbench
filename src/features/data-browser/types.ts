// 数据浏览（表/视图数据）共享类型：行状态、行数据、列信息、右键菜单。
// 消除 TableDataTab / ViewDataTab 中的重复定义（V2 §9.5）。

export enum RowState {
  SYNCED = 'SYNCED',
  NEW = 'NEW',
  MODIFIED = 'MODIFIED',
  DELETED = 'DELETED',
}

export interface DataRow {
  state: RowState;
  originalData: unknown[];
  currentData: unknown[];
}

export interface DataColumnInfo {
  name: string;
  typeName: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue: unknown;
}

export interface DataContextMenuState {
  x: number;
  y: number;
  rowIndex: number;
  colIndex: number;
  cellValue: unknown;
  rowData: unknown[];
}
