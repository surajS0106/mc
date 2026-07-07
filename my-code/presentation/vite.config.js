import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the production build works when opened from any path / static host
export default defineConfig({
  base: './',
  plugins: [react()],
})
