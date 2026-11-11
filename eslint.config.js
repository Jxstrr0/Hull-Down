import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/', 'shots/', 'node_modules/', 'public/', '.claude/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['scripts/**/*.{js,mjs,ts}', 'tests/**/*.ts', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    // The sim is pure: no three.js, no DOM, no Math.random, no Date.now.
    // tests/simPurity.test.ts scans the same folder as a second line of defence.
    files: ['src/sim/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'src/sim must not import three.js.' },
            {
              group: ['**/render/**', '**/ui/**', '**/office/**', '**/audio/**', '**/persist/**'],
              message: 'src/sim must stay pure: it may import only src/sim and src/data.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in src/sim.' },
        { object: 'Date', property: 'now', message: 'The sim runs on its own fixed time step.' },
        ...['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'exp', 'log', 'log2', 'log10', 'pow'].map((property) => ({
          object: 'Math',
          property,
          message: 'Use src/sim/det.ts so results match on every device.',
        })),
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'localStorage', 'performance'],
    },
  },
)
