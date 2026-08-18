import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aliases = ['common', 'components', 'hooks', 'helpers', 'renderer', 'utils'];

// The API server this dev server proxies /api to. Follows PORT from .env (the same
// value `pnpm dev:server` listens on), so moving the API off 3000 — e.g. when a local
// DCS owns 3000 — needs no change here. Dev-server-only; not client config.
const API_PORT = process.env.PORT || 3000;

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
        target: `http://localhost:${API_PORT}`,
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
