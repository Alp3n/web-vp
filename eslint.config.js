import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dev-dist/**',
      'coverage/**',
      'assets/build/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,js}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
    },
  },
  {
    files: ['scripts/**/*.ts', 'vite.config.ts', 'eslint.config.js', 'tests/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // Kontrakt: src/sim jest czyste i deterministyczne.
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'phaser', message: 'src/sim nie może importować Phasera (kontrakt czystej symulacji).' },
          ],
          patterns: [
            { group: ['phaser', 'phaser/*'], message: 'src/sim nie może importować Phasera.' },
            { group: ['**/assets/**', 'assets/*'], message: 'src/sim nie może importować assetów.' },
            { group: ['**/render/**', '**/input/**', '**/pwa/**'], message: 'src/sim nie może importować warstwy renderu/inputu/PWA.' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'document', message: 'src/sim nie ma dostępu do DOM.' },
        { name: 'window', message: 'src/sim nie ma dostępu do DOM.' },
        { name: 'performance', message: 'src/sim używa licznika ticków, nie zegara.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Użyj seedowanego RNG z src/sim/rng.ts.' },
        { object: 'Date', property: 'now', message: 'src/sim używa licznika ticków, nie zegara.' },
        { object: 'performance', property: 'now', message: 'src/sim używa licznika ticków, nie zegara.' },
        { object: 'globalThis', property: 'document', message: 'src/sim nie ma dostępu do DOM.' },
        { object: 'globalThis', property: 'window', message: 'src/sim nie ma dostępu do DOM.' },
      ],
    },
  },
);
