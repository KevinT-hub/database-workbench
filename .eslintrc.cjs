/* eslint-env node */
// V2 ESLint 配置
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: "detect" },
    "import/resolver": {
      typescript: { alwaysTryTypes: true },
    },
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
  ],
  plugins: ["@typescript-eslint", "react", "react-hooks", "import"],
  rules: {
    // 铁律 9：禁止裸 CSS —— UI 布局迁移阶段暂时关闭，迁移完成后重新启用
    // "no-restricted-imports": [
    //   "error",
    //   {
    //     patterns: [
    //       {
    //         group: ["**/*.css", "**/*.module.css"],
    //         message:
    //           "禁止 import CSS 文件（唯一例外：src/main.tsx 加载 src/styles/global.css）；请使用 Tailwind utility 类",
    //       },
    //     ],
    //   },
    // ],
    // 铁律 1：禁止裸 invoke —— 仅 api/client.ts 可 import @tauri-apps/api/core（见 overrides 放行）
    "import/no-restricted-paths": [
      "error",
      {
        basePath: __dirname,
        zones: [
          // 禁止任何文件直接 import @tauri-apps/api/core（除 src/api/client.ts）
          {
            target: ["src/**/*", "!src/api/client.ts"],
            from: ["node_modules/@tauri-apps/api/core"],
            message: "禁止直接 import invoke；仅 src/api/client.ts 可封装 invoke",
          },
          // 禁止绕过 api/* 模块直接 import client 的 invoke 出口
          {
            target: ["src/**/*", "!src/api/**"],
            from: ["src/api/client"],
            message: "禁止直接 import api/client；请通过 api/* 领域模块或 hooks 访问",
          },
          // 铁律 9：组件不直接 import api/ 模块，须经 hooks/* 或 feature hook 访问
          {
            target: ["src/**/*.tsx"],
            from: ["src/api/**"],
            message: "组件禁止直接 import api/ 模块；请通过 hooks/* 或 feature hook 访问数据与动作",
          },
        ],
      },
    ],
    // 铁律 13：禁止循环依赖
    "import/no-cycle": ["error", { maxDepth: 10 }],
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    // import/default 对 React 17+ 产生误报，暂时关闭
    "import/default": "off",
    "import/no-named-as-default": "off",
    "import/no-named-as-default-member": "off",
  },
  overrides: [
    // 放行 1：src/main.tsx 可 import styles/global.css
    {
      files: ["src/main.tsx"],
      rules: { "no-restricted-imports": "off" },
    },
    // 放行 2：src/api/client.ts 可 import @tauri-apps/api/core
    {
      files: ["src/api/client.ts"],
      rules: { "import/no-restricted-paths": "off" },
    },
  ],
  ignorePatterns: [
    "dist",
    "node_modules",
    "src-tauri",
    "*.config.*",
    "vite-env.d.ts",
  ],
};
