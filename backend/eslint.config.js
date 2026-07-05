// eslint.config.js — backend (Node/CommonJS)
const js = require('@eslint/js');
const globals = require('globals');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    // Vitest test files use ESM `import`/`export` (see tests/integration/
    // auth.service.test.js for why — Vitest's own package no longer
    // supports require('vitest'), and vi.mock() needs static import syntax
    // to hoist reliably).
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  prettierConfig,
];
