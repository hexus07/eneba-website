import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Colors come only from design/tokens.json via Tailwind classes (CLAUDE.md). This catches hex
// colors smuggled in as strings, template literals or arbitrary values like `bg-[#fff]`.
const HEX = '#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b';
const noRawHex = {
  'no-restricted-syntax': [
    'error',
    { selector: `Literal[value=/${HEX}/]`, message: 'No raw hex colors: use a token class (design/tokens.json → tailwind.config.ts).' },
    { selector: `TemplateElement[value.raw=/${HEX}/]`, message: 'No raw hex colors: use a token class (design/tokens.json → tailwind.config.ts).' },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      ...noRawHex,
    },
  },
  // The token pipeline test asserts the hex values tokens.json resolves to; nothing else may contain hex.
  { files: ['design-tokens.test.ts'], rules: { 'no-restricted-syntax': 'off' } },
  { files: ['eslint.config.js'], extends: [tseslint.configs.disableTypeChecked] },
);
