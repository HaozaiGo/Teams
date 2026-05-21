import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/health': 'http://localhost:4000',
    },
  },
})
