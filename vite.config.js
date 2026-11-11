import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base './' agar bisa di-hosting di subfolder mana pun (GitHub Pages, Cloudflare Pages, flashdisk).
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: { maplibre: ['maplibre-gl'], react: ['react', 'react-dom'] } } },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'media/*'],
      manifest: {
        name: 'Atlas Malatan — Peta Digital Dusun Malatan',
        short_name: 'Atlas Malatan',
        description: 'Peta digital, arsip sejarah, dan pemandu lapangan Dusun Malatan, Bansari, Temanggung.',
        lang: 'id',
        theme_color: '#1d1a16',
        background_color: '#1d1a16',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,json,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // Ubin peta & elevasi. Cache yang sama dipakai tombol "Simpan untuk offline".
            urlPattern: ({ url }) =>
              /arcgisonline\.com|maptiles\.arcgis\.com|elevation-tiles-prod|opentopomap\.org|tile\.openstreetmap\.org|demotiles/.test(url.href),
            handler: 'CacheFirst',
            options: {
              cacheName: 'atlas-tiles',
              expiration: { maxEntries: 6000, maxAgeSeconds: 60 * 60 * 24 * 120 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => /fonts\.(googleapis|gstatic)\.com/.test(url.href),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'atlas-fonts' },
          },
        ],
      },
    }),
  ],
});
