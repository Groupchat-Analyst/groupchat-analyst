import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiProxy = {
  target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:7071',
  changeOrigin: true,
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': apiProxy,
    },
  },
  preview: {
    proxy: {
      '/api': apiProxy,
    },
  },
})
