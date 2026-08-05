// api/backup.ts —— 备份/还原/调度命令

import { invoke } from './client';
import type {
  BackupRequest,
  BackupResult,
  RestoreRequest,
  RestoreResult,
  ScheduleRequest,
} from '../types/backup';

export const backupApi = {
  execute: (req: BackupRequest): Promise<BackupResult> =>
    invoke<BackupResult>('backup_execute', {
      profile: req.conn,
      options: req.options,
      outputPath: req.outputPath,
      schema: req.schema,
      selectedTables: req.selectedTables,
      selectedViews: req.selectedViews,
      selectedRoutines: req.selectedRoutines,
    }),

  restore: (req: RestoreRequest): Promise<RestoreResult> =>
    invoke<RestoreResult>('restore_execute', {
      profile: req.conn,
      request: req,
    }),

  scheduleAdd: (req: ScheduleRequest): Promise<number> =>
    invoke<number>('schedule_add', { request: req }),

  scheduleRemove: (scheduleId: number): Promise<boolean> =>
    invoke<boolean>('schedule_remove', { scheduleId }),

  scheduleList: (): Promise<[number, ScheduleRequest][]> =>
    invoke<[number, ScheduleRequest][]>('schedule_list'),
};
