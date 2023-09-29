import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@oce-editor-tools/core"'],
  },
  build: {
    rollupOptions: {
      external: [
        /^@oce-editor-tools\/.*/,
      ]
    }
  }    
})
