// api/updater.ts —— 应用更新命令

import { invoke } from './client';

export interface UpdateInfo {
  available: boolean;
  version?: string;
  date?: string;
  body?: string;
  downloadUrl?: string;
  preferredSource?: 'github' | 'gitee' | 'github-fallback' | 'gitee-fallback';
  countryCode?: string;
}

interface BackendUpdateInfo {
  available: boolean;
  version?: string;
  date?: string;
  body?: string;
  downloadUrl?: string;
  preferredSource?: 'github' | 'gitee' | 'github-fallback' | 'gitee-fallback';
  countryCode?: string;
}

const fromBackendUpdateInfo = (raw: BackendUpdateInfo): UpdateInfo => ({
  available: raw.available,
  version: raw.version,
  date: raw.date,
  body: raw.body,
  downloadUrl: raw.downloadUrl,
  preferredSource: raw.preferredSource,
  countryCode: raw.countryCode,
});

export const updaterApi = {
  checkByRegion: (): Promise<UpdateInfo> =>
    invoke<BackendUpdateInfo>('updater_check_by_region').then(
      fromBackendUpdateInfo,
    ),

  downloadAndInstallByRegion: (): Promise<void> =>
    invoke<void>('updater_download_and_install_by_region'),
};
