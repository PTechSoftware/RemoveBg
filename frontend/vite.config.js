import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true
    },
    proxy: {
      '/process-image': 'http://localhost:8000',
      '/docs': 'http://localhost:8000',
      '/openapi.json': 'http://localhost:8000'
    }
  }
})
