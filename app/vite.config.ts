import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-v2.ico', 'apple-touch-icon-v2.png', 'mask-icon.svg'],
      manifest: {
        name: 'VoiceMemory',
        short_name: 'VoiceMemory',
        description: 'On-device personal AI memory',
        theme_color: '#000000',
        icons: [
          {
            src: 'pwa-192x192-v2.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512-v2.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
