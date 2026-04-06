import pluginQuery from "@tanstack/eslint-plugin-query"
import tsPlugin from "@typescript-eslint/eslint-plugin"
import tsParser from "@typescript-eslint/parser"
import globals from "globals"

export default [
  ...pluginQuery.configs["flat/recommended"],
  {
    // Note: there should be no other properties in this object
    ignores: [".github/CODEOWNERS", ".tsbuild", ".vite", "coverage"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      semi: ["error", "never"],
    },
  },
]
