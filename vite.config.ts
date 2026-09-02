/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      includeAssets: ['icons/favicon-64.png', 'icons/favicon-dark-64.png', 'icons/icon-192.png'],
      manifest: {
        name: 'mTracker — سیستم استمرار',
        short_name: 'mTracker',
        description: 'سیستم مدیریت زمان پایدار (روش SD): ثبت ساعت روزانه، میانگین، انحراف معیار',
        lang: 'fa',
        dir: 'rtl',
        theme_color: '#4f46e5',
        background_color: '#f4f5f8',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            /* Google Fonts: cache-first so the font also works offline if the
               self-hosted bundle is ever bypassed */
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
