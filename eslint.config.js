import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // These directories contain generated bundles/compiled output, not authored source.
    ignores: ['dist/**', 'functions/lib/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    ...reactHooks.configs['recommended-latest'],
    ...reactRefresh.configs.vite,
  },
  {
    files: ['src/contexts/**/*.{ts,tsx}'],
    // Context modules intentionally export hooks alongside providers. The
    // Fast Refresh export-shape rule is not applicable to that module design.
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
);
