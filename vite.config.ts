import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/bisaya_translator/',  // This matches your repo name exactly
  build: {
    outDir: 'dist',  // Explicit output directory
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  }
})
