// api/user.ts —— 用户管理命令（V1 散落在 metadataApi 中）

import { invoke } from './client';
import type { ConnectionProfile } from '../types/connection';
import type {
  UserSummary,
  UserModelPayload,
  UserModel,
} from '../types/user';

export const userApi = {
  getCurrentUserInfo: (profile: ConnectionProfile): Promise<string> =>
    invoke<string>('metadata_get_current_user_info', { profile }),

  getAllUsers: (profile: ConnectionProfile): Promise<UserSummary[]> =>
    invoke<UserSummary[]>('metadata_get_all_users', { profile }),

  getUserDetail: (
    profile: ConnectionProfile,
    username: string,
    host: string,
  ): Promise<string> =>
    invoke<string>('metadata_get_user_detail', { profile, username, host }),

  getUserModel: (
    profile: ConnectionProfile,
    username: string,
    host: string,
  ): Promise<UserModelPayload> =>
    invoke<UserModelPayload>('metadata_get_user_model', {
      profile,
      username,
      host,
    }),

  generateUserSql: (
    user: UserModel,
    isNewUser: boolean,
    original?: UserModel,
  ): Promise<string> =>
    invoke<string>('metadata_generate_user_sql', {
      user,
      isNewUser,
      original,
    }),
};
