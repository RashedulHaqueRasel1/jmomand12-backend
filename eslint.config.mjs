import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
    extends: ['js/recommended'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: { globals: globals.node },
  },
  tseslint.configs.recommended,
  {
    ignores: ['node_modules', 'dist'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'eslint prefer-const': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'eslint-disable-next-line prefer-const': 'off',
    },
  },
]);
