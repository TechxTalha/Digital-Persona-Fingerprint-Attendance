import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'WebSdk': path.resolve(__dirname, './src/WebSdk-mock.js')
    }
  }
})
