/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  publicDir: 'assets/build',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Nightfall',
        short_name: 'Nightfall',
        description: 'Nightfall — izometryczna gra survival (PWA).',
        display: 'fullscreen',
        orientation: 'landscape',
        theme_color: '#0b0c14',
        background_color: '#0b0c14',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json}'],
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
