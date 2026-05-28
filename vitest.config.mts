import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      OPENAI_API_KEY: 'sk-test-dummy',
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
