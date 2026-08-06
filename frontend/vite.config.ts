import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons.svg', 'pwa-icon.svg', 'pwa-maskable.svg'],
      manifest: {
        name: 'PickMe',
        short_name: 'PickMe',
        description: 'PickMe - Termine bei Salons und Master in deiner Nahe',
        theme_color: '#17666D',
        background_color: '#f8f5ef',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pickme-pages',
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'script' || request.destination === 'style' || request.destination === 'worker',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'pickme-static-assets',
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'pickme-images',
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pickme-api',
              networkTimeoutSeconds: 4,
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL ?? 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('mapbox-gl')) {
            return 'mapbox'
          }

          if (id.includes('lucide-react')) {
            return 'admin'
          }

          return undefined
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
