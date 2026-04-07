import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import pluginQuery from "@tanstack/eslint-plugin-query";

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "coverage/**",
      "apps/**",
      "packages/**",
      "backups/**",
      "**/.tmp-*/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...pluginQuery.configs["flat/recommended"],
  {
    rules: {
      // Intentional: sync draft fields when server `data` refreshes (deal workspace tabs).
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
