import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Make sure this matches your repository name exactly
  base: "/bisaya_translator/", 
  server: {
    port: 3000,
    host: '0.0.0.0',
  }
})
