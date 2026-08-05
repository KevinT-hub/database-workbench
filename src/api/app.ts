// api/app.ts —— 应用级命令（更新缓存失效等）

import { invoke } from './client';

export const appApi = {
  invalidateRuntimeCache: (): Promise<void> =>
    invoke<void>('app_invalidate_runtime_cache'),
};
