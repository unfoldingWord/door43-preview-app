import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

const aliases = ['common', 'components', 'hooks', 'helpers'];

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: {},
  },
  resolve: {
    alias: aliases.map(alias => (
      {
        find: `@${alias}`,
        replacement: path.resolve(__dirname, `src/${alias}`),
      }
    ))
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
