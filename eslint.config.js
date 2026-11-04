import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// Float math on money is forbidden everywhere in src (ETH values are decimal strings; use src/lib/money.ts).
const noFloatMoney = [
  { selector: "CallExpression[callee.name='parseFloat']", message: 'No float math: ETH values are decimal strings (use lib/money).' },
  { selector: "MemberExpression[object.name='Number'][property.name='parseFloat']", message: 'No float math: ETH values are decimal strings (use lib/money).' },
]
// Stricter set for contracts and the money lib: no Number()/unary + coercion, no z.number() for amounts.
const noNumberCoercion = [
  { selector: "CallExpression[callee.name='Number']", message: 'Number() is forbidden in contracts/money: keep ETH as decimal strings (lib/money).' },
  { selector: "UnaryExpression[operator='+'][argument.type!='Literal']", message: 'Unary + coercion is forbidden in contracts/money.' },
  { selector: "CallExpression[callee.object.name='z'][callee.property.name='number']", message: 'Use z.int() for quantities and ethSchema (string) for money; z.number() is forbidden in contracts.' },
]

// `no-restricted-imports` does not see `import()`: dynamic imports of the mock layer are banned too.
const noDynamicMocksImport = [
  {
    selector: 'ImportExpression[source.value=/mocks/]',
    message: 'Only src/main.tsx may load the mock layer (dynamic import included). Fictitious data lives only in src/mocks.',
  },
]

const mocksImportBan = {
  patterns: [
    {
      group: ['**/mocks', '**/mocks/**', '@/mocks', '@/mocks/**'],
      message: 'Only src/mocks (and src/main.tsx, which starts the worker) may import the mock layer. Fictitious data lives only in src/mocks.',
    },
  ],
}

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
    // Eliminatory rule (MSW-2): fictitious data lives only in the network layer.
    // Tests talk to mocks through window.__mock (typed by MockControl in src/api/contracts/scenarios.ts).
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
    ignores: ['src/mocks/**', 'src/main.tsx'],
    rules: {
      'no-restricted-imports': ['error', mocksImportBan],
      'no-restricted-syntax': ['error', ...noFloatMoney, ...noDynamicMocksImport],
    },
  },
  {
    // Type-aware rules for app code: un-awaited promises (invalidateQueries, navigate...) must be
    // explicit (`void`) and promises must not leak into event handlers expecting `void`.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/mocks/**', 'src/routeTree.gen.ts'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
    },
  },
  {
    files: ['src/mocks/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', ...noFloatMoney] },
  },
  {
    files: ['src/api/contracts/**/*.ts', 'src/lib/money.ts'],
    rules: { 'no-restricted-syntax': ['error', ...noFloatMoney, ...noNumberCoercion, ...noDynamicMocksImport] },
  },
  { files: ['scripts/**/*.mjs', '.claude/hooks/*.mjs', 'lighthouse/*.mjs'], languageOptions: { globals: globals.node } },
)
