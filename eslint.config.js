import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'playwright-report', 'test-results', 'public/mockServiceWorker.js', 'lighthouse/reports', 'src/routeTree.gen.ts', '.spike', '.claude/worktrees/**', '.claude/skills/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: { globals: { ...globals.browser, ...globals.node }, parserOptions: { tsconfigRootDir: import.meta.dirname } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Eliminatory rule: fictitious data lives only in the network layer.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/mocks/**', 'src/main.tsx'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['**/mocks', '**/mocks/**', '@/mocks', '@/mocks/**'], message: 'App code must not import mocks (MSW network layer only).' }] }],
      'no-restricted-syntax': [
        'error',
        { selector: "CallExpression[callee.name='parseFloat']", message: 'No float math: ETH values are decimal strings (use lib/money).' },
      ],
    },
  },
  { files: ['scripts/**/*.mjs', '.claude/hooks/*.mjs', 'lighthouse/*.mjs'], languageOptions: { globals: globals.node } },
)
