const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    globals: true,
    globalSetup: ['./tests/globalSetup.js'],
    setupFiles: ['./tests/setup.js'],
    testTimeout: 20000,
    hookTimeout: 30000,
    include: ['tests/**/*.test.js'],
  },
});
