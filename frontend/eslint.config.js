import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      // No projeto, `muted` é fundo (shadcn) e não texto (wide-ui): `text-muted` pintaria o texto
      // na cor de fundo. Texto secundário é `text-muted-foreground` — ver `src/styles.css`.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/(^|[ :])text-muted($| )/]",
          message: "`text-muted` é fundo neste projeto; use `text-muted-foreground`.",
        },
        {
          selector: "TemplateElement[value.raw=/(^|[ :])text-muted($| )/]",
          message: "`text-muted` é fundo neste projeto; use `text-muted-foreground`.",
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  eslintPluginPrettier,
);
