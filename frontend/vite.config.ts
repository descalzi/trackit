import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dynamic base path: /trackit/ in production, ./ in development
  base: process.env.NODE_ENV === 'production' ? '/trackit/' : './',
  server: {
    port: 8080,
    host: true,
    allowedHosts: [
      'chunkyboy.reindeer-great.ts.net',
      '.ts.net',
    ]
  }
})
