import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aliases = ['common', 'components', 'hooks', 'helpers', 'renderer', 'utils'];

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  resolve: {
    alias: aliases.map(alias => (
      {
        find: `@${alias}`,
        replacement: path.resolve(__dirname, `src/${alias}`),
      }
    ))
  },
  optimizeDeps: {
    include: ['proskomma-core', 'proskomma-json-tools'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: undefined  // Let Vite handle chunking automatically
      }
    }
  },
})
