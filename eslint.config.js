import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { includeIgnoreFile } from '@eslint/compat'
import js from '@eslint/js'
import globals from 'globals'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

const parentDir = path.dirname(fileURLToPath(import.meta.url))
const gitignorePath = path.resolve(parentDir, '.gitignore')

export default tseslint.config(includeIgnoreFile(gitignorePath), {
  files: ['**/*.{ts,tsx}'],
  extends: [
    js.configs.recommended,
    tseslint.configs.recommended,
    jsxA11y.flatConfigs.recommended,
    reactHooks.configs['recommended-latest'],
    reactRefresh.configs.vite,
  ],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    eqeqeq: 'error',
    'no-param-reassign': 'error',
    'no-return-assign': 'error',
  },
})
