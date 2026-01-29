import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // This tells GitHub Pages where to find your files
  base: "/bisaya_translator/",
  server: {
    port: 3000,
    host: '0.0.0.0',
  }
})
