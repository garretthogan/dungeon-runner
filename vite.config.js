import { defineConfig } from 'vite'

export default defineConfig({
  appType: 'spa',
  base: process.env.BASE_PATH || '/',
})
