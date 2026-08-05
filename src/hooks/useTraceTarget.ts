// hooks/useTraceTarget.ts —— 元数据树痕迹递推 + 打开状态兜底
//
// 工具栏/菜单按钮（表/视图/函数/用户/查询/备份/还原）依据元数据树的痕迹
// （connectionStore.activeConnectionId / activeDatabase）递推当前所在的连接与数据库。
// 本 hook 在递推结果上强化兜底：
//  - connectionOpen：递推出的连接必须是「打开」状态（isConnected）才能响应；
//    若痕迹仍附着在已关闭的连接上（如先选中数据库 A，再关闭上层连接 A1），
//    与未选中连接同性质，按钮不应响应，应在通知中心提示先打开连接。
//  - databaseOpened：需要具体数据库的功能（表/视图/函数/备份）递推后还必须确认
//    数据库已「打开」（树中图标非灰，connectionStore.openedDatabasesByConnection）；
//    数据库仍为灰色未打开时，与未选中数据库同性质，同样在通知中心提示。
//
// 提供 useTraceTarget()（读取递推结果）与 requireOpenConnection / requireOpenedDatabase /
// resolveQueryTrace（按钮点击时的统一判定，返回 false 表示已提示并阻断）。

import { useConnectionStore } from '@/stores';
import type { ConnectionProfile } from '@/types';
import { showToolbarRequirementNotice } from './useToaster';

interface TraceTarget {
  /** 痕迹递推出的连接（可能不存在：连接被删除，或从未选中） */
  connection: ConnectionProfile | undefined;
  /** 是否存在连接痕迹（activeConnectionId 非空） */
  hasTrace: boolean;
  /** 递推出的连接是否处于打开状态 */
  connectionOpen: boolean;
  /** 痕迹中的数据库名（可选） */
  database: string | undefined;
  /** 递推出的数据库是否已打开（图标非灰） */
  databaseOpened: boolean;
}

export const useTraceTarget = (): TraceTarget => {
  const { connections, activeConnectionId, activeDatabase, isDatabaseOpened } =
    useConnectionStore();

  const activeConnection = connections.find((c) => c.profile.name === activeConnectionId);
  const connectionOpen = Boolean(activeConnection?.isConnected);
  const database = activeDatabase || undefined;

  return {
    connection: activeConnection?.profile,
    hasTrace: activeConnectionId != null,
    connectionOpen,
    database,
    databaseOpened: Boolean(
      connectionOpen &&
        activeConnection &&
        database &&
        isDatabaseOpened(activeConnection.profile.name, database),
    ),
  };
};

/**
 * 连接前置校验：递推出的连接必须打开才能响应；否则通知中心提示「请先打开连接」。
 * @returns 是否满足条件（false 表示已提示并阻断）
 */
export const requireOpenConnection = (target: TraceTarget, actionLabel: string): boolean => {
  if (!target.connectionOpen) {
    void showToolbarRequirementNotice(actionLabel, 'connection');
    return false;
  }
  return true;
};

/**
 * 数据库前置校验：需要具体数据库的功能必须先「选中且打开」数据库。
 *  - 无痕迹数据库（未选中）→ 提示「请选中具体数据库」
 *  - 有痕迹但数据库未打开（图标灰）→ 提示「请打开具体数据库」（与未选中同性质）
 * @returns 是否满足条件（false 表示已提示并阻断）
 */
export const requireOpenedDatabase = (target: TraceTarget, actionLabel: string): boolean => {
  if (!target.database) {
    void showToolbarRequirementNotice(actionLabel, 'database');
    return false;
  }
  if (!target.databaseOpened) {
    void showToolbarRequirementNotice(actionLabel, 'databaseOpened');
    return false;
  }
  return true;
};

interface QueryTraceResolution {
  connection: ConnectionProfile | undefined;
  database: string | undefined;
}

/**
 * 查询类动作（新建查询 / 打开 SQL 文件）的痕迹预填解析。
 *
 * 查询标签页不要求连接和数据库（原有允许，永不在通知中心阻断）——
 * 本函数只负责「预填」：仅当递推出的连接处于打开状态时预填连接，
 * 仅当连接与数据库均处于打开状态时预填数据库；
 * 连接/数据库已关闭时返回空预填，避免把过期痕迹带入新页面。
 *
 * 所有需要按痕迹预填连接/数据库的打开动作必须走本函数（统一收束点），
 * 禁止在各组件内直接读取 activeConnectionId/activeDatabase 自行拼接。
 */
export const resolveQueryTrace = (target: TraceTarget): QueryTraceResolution => ({
  connection: target.connectionOpen ? target.connection : undefined,
  database: target.databaseOpened ? target.database : undefined,
});
