import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves project sites from /<repo-name>/, so the deploy workflow
  // passes that prefix in. Local dev and root hosting fall back to "/".
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
})
