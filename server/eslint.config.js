// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**'],
  },
  tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        // Use the eslint-specific tsconfig so the parser can resolve
        // test files (tests/**) too, not just src/**. The build still uses
        // tsconfig.json with rootDir=src; this file widens parser scope only.
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Enforce no-any per project rules
      '@typescript-eslint/no-explicit-any': 'error',
      // Allow unused vars prefixed with _ (e.g., _next in error handlers)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
