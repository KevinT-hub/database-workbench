import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from '@tauri-apps/api/window';
import App from "./App";

type Theme = 'light' | 'dark';

function resolveInitialTheme(): Theme {
  try {
    const state = localStorage.getItem('app-storage');
    if (state) {
      const parsed = JSON.parse(state);
      if (parsed?.state?.theme === 'dark') {
        return 'dark';
      }
    }
  } catch {
    // 忽略主题存储解析错误，回退到系统偏好
  }

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

function applyInitialTheme(theme: Theme): void {
  document.documentElement.classList.remove('bp5-light', 'bp5-dark', 'bp6-light', 'bp6-dark');
  document.documentElement.classList.add(`bp5-${theme}`, `bp6-${theme}`);

  if (theme === 'dark') {
    document.documentElement.style.backgroundColor = '#2f343c';
    document.documentElement.style.color = '#f5f8fa';
  } else {
    document.documentElement.style.backgroundColor = '#ffffff';
    document.documentElement.style.color = '#1c2127';
  }
}

const initialTheme = resolveInitialTheme();
applyInitialTheme(initialTheme);
getCurrentWindow().setTheme(initialTheme).catch(() => {
});

const warmupMonaco = () => {
  import('./lib/monaco').catch((error) => {
    console.error('Failed to initialize Monaco environment:', error);
  });
};

const requestIdle = (window as Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
}).requestIdleCallback;

if (typeof requestIdle === 'function') {
  requestIdle(warmupMonaco, { timeout: 1200 });
} else {
  setTimeout(warmupMonaco, 120);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
