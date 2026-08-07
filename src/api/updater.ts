// api/updater.ts —— 应用更新命令

import { invoke } from './client';

export interface UpdateInfo {
  available: boolean;
  version?: string;
  date?: string;
  body?: string;
  downloadUrl?: string;
}

interface BackendUpdateInfo {
  available: boolean;
  version?: string;
  date?: string;
  body?: string;
  downloadUrl?: string;
}

const fromBackendUpdateInfo = (raw: BackendUpdateInfo): UpdateInfo => ({
  available: raw.available,
  version: raw.version,
  date: raw.date,
  body: raw.body,
  downloadUrl: raw.downloadUrl,
});

export const updaterApi = {
  check: (): Promise<UpdateInfo> =>
    invoke<BackendUpdateInfo>('updater_check').then(
      fromBackendUpdateInfo,
    ),

  downloadAndInstall: (): Promise<void> =>
    invoke<void>('updater_download_and_install'),
};
