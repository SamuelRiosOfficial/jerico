import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const nativeBuild = process.env.JERICO_NATIVE_BUILD === '1';
const mobileAssetPathPlugin = {
  name: 'jerico-mobile-asset-paths',
  enforce: 'pre',
  transform(source, id) {
    if (process.env.JERICO_MOBILE_BUILD !== '1' || !id.endsWith('.css')) return null;
    return source.replaceAll('/jerico/assets/', '/assets/');
  }
};

const pwaPlugin = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['icons/apple-touch-icon.png'],
  manifest: {
    id: './',
    name: 'JERICO — Camino a Jericó',
    short_name: 'JERICO',
    description: 'Un juego bíblico para aprender jugando.',
    lang: 'es',
    theme_color: '#24152d',
    background_color: '#24152d',
    display: 'standalone',
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
  plugins: [mobileAssetPathPlugin, react(), ...(nativeBuild ? [] : [pwaPlugin])],
  base: '/jerico/'
});