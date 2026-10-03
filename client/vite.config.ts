import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

const apiTarget = process.env.VITE_DEV_API_TARGET ?? 'http://localhost:4000'

// The dev server and `vite preview` proxy the API and Socket.io to the backend,
// so the browser always talks to one origin (same as the nginx setup in Docker).
const proxy = {
  '/api': { target: apiTarget, changeOrigin: true },
  '/socket.io': { target: apiTarget, changeOrigin: true, ws: true },
}

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) },
  },
  server: { proxy },
  preview: { proxy },
  build: {
    chunkSizeWarningLimit: 1200,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      workbox: {
        // Never serve the app shell for API or socket requests.
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
      manifest: {
        name: 'HealthSync',
        short_name: 'HealthSync',
        description: 'Offline-first patient record system',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
