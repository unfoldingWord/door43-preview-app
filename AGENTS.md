# Repository Guidelines

[![Node >= 22](https://img.shields.io/badge/Node-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm >= 10](https://img.shields.io/badge/pnpm-%3E%3D10-f69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![React 18](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=061d2a)](https://react.dev/)
[![Vite 7](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)

## Architecture Overview
- **Server-rendered.** An Express server (`server/`) renders DCS resources to HTML via
  `@unfoldingword/door43-preview-renderers` and delegates HTML→PDF to a WeasyPrint
  sidecar. The React client (`src/rebuild/PreviewApp.jsx`) is thin — it drives an iframe
  at `/api/preview/*` and renders no content itself.
- Rendered output is cached (disk or S3), keyed on a composite identity; PDFs render on an
  async queue and can be pre-warmed.
- See **`CLAUDE.md`** for the architecture map and **`docs/OPERATIONS.md`** for env vars,
  queue/priority, warming, and local/QA/production deployment.

```
browser (thin SPA) → Express (renderers lib, cache, PDF queue) → DCS
                                                └→ WeasyPrint sidecar → PDF
```

## Project Structure & Module Organization
- **Client:** `src/main.jsx` → `src/rebuild/PreviewApp.jsx` (active). `src/utils/debug.js`
  is the client debug helper. The legacy `src/{components,hooks,helpers,renderer}` tree is
  retained for salvage but **unmounted** — don't extend it.
- **Server:** `server/index.js`; routes in `server/routes/`; core logic in `server/lib/`.
- **Sidecar:** `weasyprint-service/` (HTML→PDF; bakes OBS images).
- **Assets:** `public/`, `images/`. **Config template:** `.env.example`.

## Build, Test, and Development Commands
- Install: `pnpm install` (Node >= 22, pnpm >= 10).
- Dev: `pnpm dev:server` (API on :3000) + `pnpm dev` (Vite on :5173, proxies `/api`).
- PDFs: `docker compose up -d weasyprint` (or set `WEASYPRINT_SERVICE_URL`).
- Lint: `pnpm lint`. Build: `pnpm build`. Preview built: `pnpm preview`. Full stack: `docker compose up --build`.
- Config is **runtime** env (see `.env.example` / `docs/OPERATIONS.md`) — no `VITE_*` for server settings. Verbose logs: `DEBUG_MODE=1` (server), `?debug=1` (client).

## Coding Style & Naming Conventions
- JS/React, 2-space indentation, single quotes. Run `pnpm lint` before PRs.
- Function components + hooks. Server is ESM; keep shared logic pure in `server/lib/`.
- Route new server logs through `server/lib/log.js` (`log.debug/info/warn/error`), not raw `console`.
- Cache correctness depends on the composite identity (`server/lib/render-identity.js`) — if
  you change what a render consumes, account for it there.

## Testing Guidelines
- No unit test runner. Validate by exercising the affected flow (`pnpm dev:server` + `pnpm dev`),
  or `pnpm build && pnpm preview`. Confirm PDF changes against the WeasyPrint sidecar.

## Commit & Pull Request Guidelines
- Commits: concise, imperative, scoped (e.g., "Add warm endpoint", "Fix stale nav"). Reference issues.
- PRs: summary, linked issues, test steps, screenshots for UI, and any `.env`/config notes.
  Ensure lint passes and the build succeeds locally.

## Security & Configuration Tips
- Never commit secrets. In production, secrets (AWS, `PREVIEW_VERIFICATION_KEY`, `WARM_TOKEN`)
  come from the env (openbao via Puppet), not the repo.
- Sanitize any HTML before rendering; avoid unsafe `dangerouslySetInnerHTML`.
- The `/api/warm` endpoint is token-gated (`WARM_TOKEN`); crons only run with `RUN_CRONS=1`.
