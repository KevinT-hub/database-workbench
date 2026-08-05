// lib/cn.ts —— className 合并工具
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并 className，自动解决 Tailwind utility 冲突
 * @example cn('px-2 py-1', condition && 'bg-red-500', 'px-4') → 'py-1 bg-red-500 px-4'
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
