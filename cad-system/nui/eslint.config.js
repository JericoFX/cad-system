import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '~/utils/nui',
              message: 'Use ~/utils/fetchNui instead.',
            },
          ],
          patterns: [
            {
              group: ['./utils/nui', '../utils/nui', '../../utils/nui', '../../../utils/nui'],
              message: 'Use ~/utils/fetchNui instead.',
            },
          ],
        },
      ],
    },
  },
];
