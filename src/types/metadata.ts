// 元数据相关类型

// 表、视图、函数、列、外键、索引、触发器、检查约束使用 Record<string, string>
export type MetadataRecord = Record<string, string>;

export interface TableDetail {
  Name: string;
  Rows?: number;
  DataLength?: number;
  Engine?: string;
  UpdateTime?: string;
  Comment?: string;
}

export interface ViewDetail {
  Name: string;
  Definition?: string;
  CheckOption?: string;
  IsUpdatable?: string;
  Definer?: string;
  SecurityType?: string;
  CreateTime?: string;
  UpdateTime?: string;
}

export interface FunctionDetail {
  Name: string;
  Type: string;
  DataType?: string;
  Definition?: string;
  IsDeterministic?: string;
  SqlDataAccess?: string;
  SecurityType?: string;
  Definer?: string;
  CreateTime?: string;
  UpdateTime?: string;
  Comment?: string;
}

export interface RoutineParam {
  name: string;
  type: string;
  mode?: string;
}

export interface RoutineDetail {
  name: string;
  type: string;
  returnType?: string;
  params: RoutineParam[];
}

export interface RoutineParamInfo {
  name: string;
  type: string;
  mode?: string;
}
