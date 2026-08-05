// api/client.ts —— Tauri invoke 统一封装 + 错误归一化
// 唯一允许 import @tauri-apps/api/core 的文件

import { invoke as rawInvoke } from '@tauri-apps/api/core';

/**
 * V2 统一错误类型，下游 catch 拿到的是类型化错误
 */
class AppError extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/**
 * 从 Tauri invoke 抛出的错误中提取可读消息。
 *
 * Tauri 后端 `Err(AppError)` 会被序列化为 `{ code, message }` 对象
 * （见 src-tauri/src/errors.rs 的 AppError::serialize），
 * 该对象既不是 Error 实例，String() 后也只是 "[object Object]"。
 * 这里负责把它转成可读字符串。
 */
const extractErrorMessage = (e: unknown): string => {
  if (e instanceof Error) {
    return e.message;
  }
  if (typeof e === 'object' && e !== null) {
    const obj = e as { message?: unknown; code?: unknown };
    if (typeof obj.message === 'string' && obj.message.length > 0) {
      return obj.message;
    }
    if (typeof obj.code === 'string' && obj.code.length > 0) {
      return obj.code;
    }
  }
  if (typeof e === 'string') {
    return e;
  }
  return String(e);
};

/**
 * 统一 invoke 封装：错误归一化为 AppError
 */
export const invoke = async <T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> => {
  try {
    return await rawInvoke<T>(cmd, args);
  } catch (e) {
    throw new AppError('TAURI_INVOKE_ERROR', extractErrorMessage(e), e);
  }
};
