// lib/fp.ts —— 函数式工具（debounce / throttle）

export interface DebouncedFunction<T extends unknown[]> {
  (...args: T): void;
  cancel: () => void;
  flush: () => void;
  isPending: () => boolean;
}

export const debounce = <T extends unknown[]>(
  fn: (...args: T) => void,
  waitMs: number,
): DebouncedFunction<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: T | null = null;

  const invoke = () => {
    timer = null;
    if (pendingArgs) {
      const args = pendingArgs;
      pendingArgs = null;
      fn(...args);
    }
  };

  const debounced = ((...args: T) => {
    pendingArgs = args;
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(invoke, waitMs);
  }) as DebouncedFunction<T>;

  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pendingArgs = null;
  };

  debounced.flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      invoke();
    }
  };

  debounced.isPending = () => timer !== null;

  return debounced;
};

export const throttle = <T extends unknown[]>(
  fn: (...args: T) => void,
  waitMs: number,
): ((...args: T) => void) => {
  let lastRun = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: T | null = null;

  const invoke = (args: T) => {
    lastRun = Date.now();
    timer = null;
    pendingArgs = null;
    fn(...args);
  };

  return (...args: T) => {
    const now = Date.now();
    const remaining = waitMs - (now - lastRun);
    pendingArgs = args;

    if (remaining <= 0) {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      invoke(args);
      return;
    }

    if (timer === null) {
      timer = setTimeout(() => {
        if (pendingArgs) {
          invoke(pendingArgs);
        }
      }, remaining);
    }
  };
};
