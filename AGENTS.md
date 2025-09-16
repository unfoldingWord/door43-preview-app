# Repository Guidelines

[![Node >= 18](https://img.shields.io/badge/Node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm >= 8](https://img.shields.io/badge/pnpm-%3E%3D8-f69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![React 18](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=061d2a)](https://react.dev/)
[![Vite 5](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)

## Architecture Overview
- Vite + React SPA deployed on Netlify (`netlify.toml` handles SPA routing and headers).
- Component-driven UI in `src/components`, with state composed via context and hooks.
- Data helpers in `src/helpers` normalize and render DCS content (USFM/OBS/TA/TW, etc.).
- Aliased imports (`@components`, `@helpers`, etc.) configured in `vite.config.js` and `jsconfig.json`.
- Build artifacts output to `dist/`; Netlify serves `dist/` with a catch-all redirect to `index.html`.

```
UI (components/hooks)
   ↓ uses
Helpers (render/transform)
   ↓ fetch
DCS APIs / S3 content
   ↓ output
Preview & Print (browser/PDF)
```

## Project Structure & Module Organization
- Entry: `src/main.jsx` → `src/App.jsx`.
- Source: `src/{components,helpers,hooks,common,renderer,utils}`.
- Assets: `public/` (served as-is), repository images in `images/`.
- Deployment: `netlify/` and `netlify.toml`.
- Root utilities: Python scripts used for ancillary tasks (not part of web build).

## Build, Test, and Development Commands
- Install: `pnpm install` (Node 18+ recommended; pnpm 8+).
- Dev server: `pnpm dev` (hot reload via Vite).
- Lint: `pnpm lint` (ESLint; fails on warnings).
- Build: `pnpm build` (outputs `dist/`).
- Preview: `pnpm preview` (serve built assets locally).
- Netlify dev: `pnpm netlify-dev` (respects `netlify.toml`).
- Env: client vars in `.env` as `VITE_*` (e.g., `VITE_PREVIEW_S3_BUCKET_NAME=...`).

## Coding Style & Naming Conventions
- JS/React, 2-space indentation, single quotes. Run `pnpm lint` before PRs.
- Components: PascalCase in `src/components` (e.g., `OpenBibleStories.jsx`). Use function components and hooks.
- Hooks: `src/hooks/useXxx.jsx` (e.g., `useFetchBookFiles.jsx`).
- Helpers: `src/helpers/*.js[x]` for pure utilities; import via aliases.
- Exports: default for a single primary export; named otherwise.

## Testing Guidelines
- No unit test runner configured. Validate changes by:
  - Running `pnpm dev` and exercising affected flows.
  - Building with `pnpm build` and checking via `pnpm preview`.
- For logic-heavy additions, keep functions pure in `helpers/` and include inline usage examples.

## Commit & Pull Request Guidelines
- Commits: concise, imperative, scoped (e.g., “Add editor mode”, “Fix code blocks”). Reference issues when applicable.
- PRs include: summary, linked issues, test steps, screenshots for UI, config/`.env` notes. Ensure lint passes and build succeeds locally.

## Security & Configuration Tips
- Do not commit secrets. Only expose client-safe `VITE_*` values.
- Sanitize any HTML before rendering; avoid unsafe `dangerouslySetInnerHTML`.
- SPA routing and CORS managed in `netlify.toml`; do not duplicate redirects in code.
