export default [
  {
    ignores: ['dist', 'node_modules', 'build'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        node: true,
        console: true,
        process: true,
      },
    },
    plugins: {
      '@typescript-eslint': '@typescript-eslint/eslint-plugin',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-types': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
    },
  },
];
