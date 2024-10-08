import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import svgr from 'vite-plugin-svgr';
import path from 'path'

const aliases = ['assets', 'common', 'components', 'hooks', 'helpers', 'renderer'];

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        ref: true,
      }
    }),
  ],
  define: {
    global: {},
  },
  resolve: {
    alias: aliases.map(alias => ({
      find: `@${alias}`,
      replacement: path.resolve(__dirname, `src/${alias}`),
    }))
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
  },
})
