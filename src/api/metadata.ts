// api/metadata.ts —— 元数据查询命令（无缓存，缓存由 metadataStore 负责）

import { invoke } from './client';
import type { ConnectionProfile } from '../types/connection';
import type {
  TableDetail,
  ViewDetail,
  FunctionDetail,
  RoutineDetail,
  RoutineParamInfo,
  MetadataRecord,
} from '../types/metadata';

export const metadataApi = {
  listDatabases: (profile: ConnectionProfile): Promise<string[]> =>
    invoke<string[]>('metadata_list_databases', { profile }),

  listTables: (profile: ConnectionProfile, database: string): Promise<string[]> =>
    invoke<string[]>('metadata_list_tables', { profile, schema: database }),

  listTableDetails: (
    profile: ConnectionProfile,
    database: string,
  ): Promise<TableDetail[]> =>
    invoke<TableDetail[]>('metadata_list_table_details', { profile, schema: database }),

  listViews: (profile: ConnectionProfile, database: string): Promise<string[]> =>
    invoke<string[]>('metadata_list_views', { profile, schema: database }),

  listViewDetails: (
    profile: ConnectionProfile,
    database: string,
  ): Promise<ViewDetail[]> =>
    invoke<ViewDetail[]>('metadata_list_view_details', { profile, schema: database }),

  listFunctions: (profile: ConnectionProfile, database: string): Promise<string[]> =>
    invoke<string[]>('metadata_list_functions', { profile, schema: database }),

  listRoutinesWithDetails: (
    profile: ConnectionProfile,
    database: string,
  ): Promise<RoutineDetail[]> =>
    invoke<RoutineDetail[]>('metadata_list_routines_with_details', {
      profile,
      schema: database,
    }),

  listFunctionDetails: (
    profile: ConnectionProfile,
    database: string,
  ): Promise<FunctionDetail[]> =>
    invoke<FunctionDetail[]>('metadata_list_function_details', {
      profile,
      schema: database,
    }),

  getFunctionDdl: (
    profile: ConnectionProfile,
    database: string,
    name: string,
    routineType: string,
  ): Promise<string> =>
    invoke<string>('metadata_get_function_ddl', {
      profile,
      schema: database,
      name,
      routineType,
    }),

  getRoutineParams: (
    profile: ConnectionProfile,
    database: string,
    name: string,
  ): Promise<RoutineParamInfo[]> =>
    invoke<RoutineParamInfo[]>('metadata_get_routine_params', {
      profile,
      schema: database,
      name,
    }),

  listColumns: (
    profile: ConnectionProfile,
    database: string,
    table: string,
  ): Promise<MetadataRecord[]> =>
    invoke<MetadataRecord[]>('metadata_list_columns', {
      profile,
      schema: database,
      table,
    }),

  listForeignKeys: (
    profile: ConnectionProfile,
    database: string,
    table: string,
  ): Promise<MetadataRecord[]> =>
    invoke<MetadataRecord[]>('metadata_list_foreign_keys', {
      profile,
      schema: database,
      table,
    }),

  listIndexes: (
    profile: ConnectionProfile,
    database: string,
    table: string,
  ): Promise<MetadataRecord[]> =>
    invoke<MetadataRecord[]>('metadata_list_indexes', {
      profile,
      schema: database,
      table,
    }),

  listTriggers: (
    profile: ConnectionProfile,
    database: string,
    table: string,
  ): Promise<MetadataRecord[]> =>
    invoke<MetadataRecord[]>('metadata_list_triggers', {
      profile,
      schema: database,
      table,
    }),

  listChecks: (
    profile: ConnectionProfile,
    database: string,
    table: string,
  ): Promise<MetadataRecord[]> =>
    invoke<MetadataRecord[]>('metadata_list_checks', {
      profile,
      schema: database,
      table,
    }),

  loadDdl: (
    profile: ConnectionProfile,
    database: string,
    table: string,
  ): Promise<string> =>
    invoke<string>('metadata_load_ddl', { profile, schema: database, table }),

  getAllDatabases: (profile: ConnectionProfile): Promise<string[]> =>
    invoke<string[]>('metadata_get_all_databases', { profile }),
};
