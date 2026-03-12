import { defineConfig } from 'vite'
import { copyFileSync, existsSync } from 'fs'
import { join } from 'path'

export default defineConfig({
  appType: 'spa',
  base: process.env.BASE_PATH || '/',
  plugins: [
    {
      name: 'github-pages-404',
      closeBundle() {
        const outDir = join(process.cwd(), 'dist')
        const index = join(outDir, 'index.html')
        const fallback = join(outDir, '404.html')
        if (existsSync(index)) {
          copyFileSync(index, fallback)
        }
      },
    },
  ],
})
