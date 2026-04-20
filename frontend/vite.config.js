import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// FIX: proxy target 5000 → 8080 (backend port)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
})
