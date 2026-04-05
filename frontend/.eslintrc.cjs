module.exports = {
  env: { browser: true, es2021: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
};
