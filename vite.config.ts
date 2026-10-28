import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import { verifyPublicData } from './scripts/verify-public-data.ts'

export default defineConfig({
  plugins: [vue(), {
    name: 'protect-private-game-files',
    configResolved(config) {
      if (config.publicDir) verifyPublicData(config.publicDir)
    }
  }],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.spec.ts', 'tests/integration/**/*.spec.ts']
  }
})
