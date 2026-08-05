// 标签页类型

import type { ConnectionProfile } from './connection';

export type TabType =
  | 'query'
  | 'tableList'
  | 'viewList'
  | 'functionList'
  | 'tableData'
  | 'viewData'
  | 'designer'
  | 'viewDesigner'
  | 'functionDesigner'
  | 'userManager'
  | 'userEditor'
  | 'welcome';

export type ObjectType = 'TABLE' | 'VIEW' | 'FUNCTION';

export type DesignerActionTarget = 'field' | 'index' | 'foreignKey' | 'check' | 'trigger';

export type DesignerActionKind = 'new' | 'edit' | 'delete' | 'rename';

export interface DesignerActionRequest {
  target: DesignerActionTarget;
  action: DesignerActionKind;
  name?: string;
  newName?: string;
  nonce: number;
}

export interface Tab {
  id: string;
  type: TabType;
  title: string;
  connectionId?: string;
  database?: string;
  table?: string;
  objectName?: string;
  objectType?: ObjectType;
  isModified?: boolean;
  data?: unknown;
  sqlContent?: string;
  sqlFilePath?: string;
  connectionProfile?: ConnectionProfile;
}
