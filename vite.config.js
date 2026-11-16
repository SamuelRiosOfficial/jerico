import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const nativeBuild = process.env.JERICO_NATIVE_BUILD === '1';

const pwaPlugin = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['icons/apple-touch-icon.png'],
  manifest: {
    id: './',
    name: 'JERICO — Camino a Jericó',
    short_name: 'JERICO',
    description: 'Un juego bíblico para aprender jugando.',
    theme_color: '#24152d',
    background_color: '#24152d',
    display: 'standalone',
    orientation: 'portrait',
    start_url: './',
    scope: './',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,webmanifest,mp4,json,gz}'],
    maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
    cleanupOutdatedCaches: true,
    navigateFallback: 'index.html'
  }
});

export default defineConfig({
  plugins: [react(), ...(nativeBuild ? [] : [pwaPlugin])],
  base: '/jerico/'
});