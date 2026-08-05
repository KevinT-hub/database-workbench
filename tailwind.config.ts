import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // 启用 Tailwind Preflight（BP6 兼容测试通过）
  corePlugins: { preflight: true },
  theme: {
    extend: {
      colors: {
        // 主题色板（与 global.css 的 CSS 变量同步）
        "app-bg": "var(--app-bg)",
        "app-text": "var(--app-text)",
        sidebar: {
          DEFAULT: "var(--sidebar-bg)",
          hover: "var(--sidebar-hover)",
          active: "var(--sidebar-active)",
        },
        "toolbar-bg": "var(--toolbar-bg)",
        "statusbar-bg": "var(--statusbar-bg)",
        "editor-bg": "var(--editor-bg)",
        "update-dot": "var(--update-dot)",
        // 兼容 V1 的 --page-bg
        "page-bg": "var(--page-bg)",
      },
      height: {
        toolbar: "48px",
        statusbar: "32px",
        menubar: "30px",
      },
      minWidth: { sidebar: "180px" },
      maxWidth: { sidebar: "500px" },
      animation: {
        "pulse-soft": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fade-in 0.2s ease-in",
        "slide-in": "slide-in 0.2s ease-out",
        spin: "spin 1s linear infinite",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
      },
    },
  },
} satisfies Config;
