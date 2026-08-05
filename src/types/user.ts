// 用户管理类型

export interface UserModel {
  username: string;
  host: string;
  plugin?: string;
  password?: string;
  serverPrivileges: string[];
  databasePrivileges: Record<string, string[]>;
}

export interface UserSummary {
  username: string;
  host: string;
  plugin?: string;
  status: string;
}

export interface UserModelPayload {
  username: string;
  host: string;
  plugin?: string;
  serverPrivileges: string[];
  databasePrivileges: Record<string, string[]>;
}
