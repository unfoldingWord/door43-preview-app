# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **server-rendered** preview service for unfoldingWord Bible-translation resources from
the **Door43 Content Service (DCS)**. An Express server renders resources to HTML using
the shared **`@unfoldingword/door43-preview-renderers`** library and delegates HTML→PDF
to a small **WeasyPrint** sidecar. The React client (`src/rebuild/PreviewApp.jsx`) is
**thin** — it drives an `<iframe>` pointed at the server's `/api/preview/*` routes and
renders no resource content itself. Rendered output is cached (disk or S3). Live at
https://preview.door43.org.

For deep domain knowledge of the resources themselves (book packages, DCS catalog,
TSV/USFM formats, GL quotes, resource subjects), invoke the **`uw-book-packages`** skill
before working on any renderer or DCS-fetching code. For the full operational picture
(env vars, deployment, queue/priority, warming), see **`docs/OPERATIONS.md`**.

## Commands

Requires **Node >= 22** and **pnpm >= 10** (`.nvmrc` pins 22; `corepack enable` provides pnpm).

```bash
pnpm install
pnpm dev          # Vite dev server on :5173 (proxies /api → :3000)
pnpm dev:server   # Express server on :3000 — run alongside `pnpm dev` (add DEBUG_MODE=1 for verbose logs)
pnpm build        # production build → dist/ (the thin client)
pnpm preview      # serve built dist/ on :4173
pnpm start        # NODE_ENV=production Express on :3000 (serves dist/ + API)
pnpm lint         # ESLint (.jsx/.js); fails on errors, allows warnings
pnpm cache:clean  # clear the disk cache
```

PDFs need the WeasyPrint sidecar: `docker compose up -d weasyprint`, or point
`WEASYPRINT_SERVICE_URL` at one. There is **no test runner** — validate by exercising the
flow (`pnpm dev` + `pnpm dev:server`) or `pnpm build && pnpm preview`. Full stack:
`docker compose up --build` (see `docs/OPERATIONS.md`).

## Architecture

**The Express server is the core; the client is a thin shell.** A request names a
resource (`owner`, `repo`, `ref`, `books`, `pageSize`, …); the server resolves it,
renders via the library, caches, and returns HTML or a PDF. The client points an iframe
at those routes.

**Routes** (`server/routes/`): `render-html` (web), `render-pdf` (POST enqueue / GET
`:jobId` status / GET descriptor serve), `nav` (chapter/verse tree), `preview-status`
(freshness → "updating…" banner), `warm` (cache warming), `catalog` (search/tags/
branches/entry), `weasyprint` (HTML→PDF proxy to the sidecar), `config`.

**Server libs** (`server/lib/`) — the interesting logic lives here:
- `render-identity.js` — the **composite identity**: a hash over every resource + book
  file a render actually uses (ULT/UST/UGNT/UHB, TW, TA, …), TTL-cached. This is the
  cache/staleness key, so a book only re-renders when content it uses changes.
- `html-data.js` — cached access to `renderHtmlData()` output; **serve-stale-while-
  revalidate** for moved branches.
- `preview-cache.js` + `cache-disk.js` / `cache-s3.js` — pluggable cache backend
  (disk for dev, S3 for prod), namespaced by DCS host.
- `job-queue.js` + `job-queue-memory.js` / `job-queue-bullmq.js` — async PDF queue,
  in-process or BullMQ/Redis, with **priority**: interactive requests (1) jump ahead of
  warm/cron (10); re-requesting a warm-queued PDF bumps it.
- `warm.js` + `warm-cron.js` — cache warming (endpoint + `RUN_CRONS`-gated cron).
- `dcs-host.js` — DCS selection: `?server=` > `DCS_HOST` > hostname > default **QA**
  (PROD on `preview.door43.org`). PROD=git.door43.org, QA=qa.door43.org, DEV=develop.door43.org.
- `log.js` — leveled logging gated by `DEBUG_MODE`/`VERBOSE_MODE` (see below).

**Render flow:**
```
request → resolveRenderIdentity (composite key) → getHtmlData (cache HIT, or render via
  the library) → renderHTML (web) or renderPdf → WeasyPrint sidecar (PDF) → cache + return
```

**Client** (`src/rebuild/PreviewApp.jsx`, mounted by `src/main.jsx`): search catalog →
pick resource/version/book → set the iframe to `/api/preview/html` or drive the PDF job.
It never renders resource content. Client debug logging lives in `src/utils/debug.js`.

**Legacy (do not treat as live):** the old client-side architecture — `src/components/
App.context.jsx`, the `Rc*`/`Bible`/`OpenBibleStories` `ResourceComponent` tree, and the
Proskomma + PagedJS "browser-print" pipeline — **remains in the repo for salvage but is
no longer mounted** (`main.jsx` mounts `PreviewApp`). Don't extend it; add behavior in the
server + `PreviewApp`.

## Configuration & logging

- **Runtime, not build-time.** No `VITE_*`/`import.meta.env` config for server settings.
  `.env.example` documents every variable; `docs/OPERATIONS.md §9` is the full reference.
  Key ones: `DCS_HOST`, `PREVIEW_CACHE_BACKEND`/`AWS_S3_BUCKET`, `WEASYPRINT_SERVICE_URL`,
  `REDIS_URL`, `PREVIEW_WORKER`, `RUN_CRONS`+`WARM_*`, `PREVIEW_VERIFICATION_KEY`.
- **Logging:** `DEBUG_MODE=1` (server) → verbose (access log, cache timings, downloads);
  off → lifecycle + warnings/errors only. Client: `?debug=1`. Route new logs through
  `server/lib/log.js` (`log.debug/info/warn/error`), not raw `console`.

## Conventions

- Function components only; 2-space indent, single quotes. Server is ESM (`server/`),
  routes in `server/routes/`, shared logic in `server/lib/`.
- Path aliases (`@components`, `@hooks`, `@helpers`, `@renderer`, `@utils`, `@common` →
  `src/*`, in `vite.config.js`/`jsconfig.json`) exist mainly for the legacy client; the
  rebuild client is small and uses relative imports + MUI.
- Cache correctness hinges on the **composite identity** — if you change what a render
  consumes, make sure `render-identity.js` accounts for it, or the cache goes stale-wrong.
- Commit style: concise, imperative subject lines; note any `.env`/config changes.
