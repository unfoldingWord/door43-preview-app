module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'netlify', 'server', 'src/utils/translationNotesRenderer.js'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.3' } },
  plugins: ['react-refresh'],
  // Node-side tooling files: browser globals don't apply and `process` does.
  // (The `server` dir is already in ignorePatterns above.)
  overrides: [
    {
      files: ['vite.config.js', 'scripts/**/*.{js,mjs}'],
      env: { node: true, browser: false },
    },
  ],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
}
