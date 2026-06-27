# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A React 18 + Vite SPA that fetches unfoldingWord Bible-translation resources from the **Door43 Content Service (DCS)** and renders them two ways: an interactive **web preview** and a paginated **print preview** (PagedJS → browser print/PDF). An Express server serves the built app and provides a filesystem cache API. Live at https://preview.door43.org.

For deep domain knowledge of the resources themselves (book packages, DCS catalog, TSV/USFM formats, GL quotes, resource subjects), invoke the **`uw-book-packages`** skill before working on any renderer or DCS-fetching code.

## Commands

Requires **Node >= 22** and **pnpm >= 10** (`.nvmrc` pins 22; `corepack enable` provides pnpm).

```bash
pnpm install
pnpm dev          # Vite dev server on :5173 (proxies /api → :3000)
pnpm dev:server   # Express server on :3000 — run alongside `pnpm dev` to test caching
pnpm build        # production build → dist/
pnpm preview      # serve built dist/ on :4173
pnpm start        # NODE_ENV=production Express on :3000 (serves dist/ + API)
pnpm lint         # ESLint (.jsx/.js); fails on errors, allows warnings
```

There is **no test runner**. Validate changes by running `pnpm dev` and exercising the affected flow, or `pnpm build && pnpm preview`. Docker: `pnpm docker:compose` (see `DOCKER_DEPLOYMENT.md`).

## Architecture

The app is **URL-driven**. A URL like `/u/{owner}/{repo}/{ref}?book=...&server=...#hash` fully determines what renders.

**`src/components/App.context.jsx` is the brain.** It is a single large context provider that:
1. Parses the URL (owner/repo/ref/hash, plus query params), picks the DCS server, and fetches the runtime config from `/api/config`.
2. Fetches the DCS owner → repo → **catalog entry** via `@helpers/dcsApi`.
3. **Selects a `ResourceComponent`** by switching on the catalog entry's `metadata_type` (`rc` | `sb` | `ts` | `tc`) and `subject`/`flavor`. E.g. `Bible`, `OpenBibleStories`, `TsBible`, and the `Rc*` family (`RcTranslationNotes`, `RcTranslationWords`, `RcTranslationAcademy`, `RcStudyQuestions`, `RcObs*`, etc.).
4. Holds shared state including `htmlSections`, `builtWith`, `books`/`expandedBooks`, print options, and cache bookkeeping.

**Render flow** (`AGENTS.md` and `ARCHITECHTURE.md` have diagrams, but see the drift note below):

```
URL → App.context (parse + fetch catalog entry + pick ResourceComponent)
   → ResourceComponent fetches its content via @hooks/* and @helpers/*
   → content pipeline (Proskomma + sofria2html for USFM; markdown-it for OBS; papaparse for TSV)
   → produces htmlSections = { css: { web, print }, cover, copyright, toc, body }
   → AppWorkspace renders htmlSections via:
        WebPreviewComponent   (interactive)
        PrintPreviewComponent (PagedJS pagination → browser print/PDF)
```

Every `ResourceComponent` follows the same contract: fetch + transform its resource, then call `setHtmlSections(...)` and `setBuiltWith(...)`. `htmlSections.body` plus the web/print CSS is what actually gets displayed. Scripture goes through **Proskomma** (`proskomma-core` → `SofriaRenderFromProskomma` → `@renderer/sofria2html`); OBS through markdown; TN/TQ/SQ through TSV helpers (`@helpers/tsv`, `@helpers/quotes`, GL-quote hooks).

**Caching.** Rendered `htmlSections` are cached as gzipped JSON keyed by `owner/repo/ref/book`. The Express server (`server/routes/`) reads/writes them under `CACHE_DIR`. `App.context` decides whether a cached copy is stale by comparing the catalog entry's `commit_sha`, the `APP_VERSION`, and every dependency in `builtWith` (each resource + its commit SHA). Cache uploads (`uploadCachedBook` in `@helpers/books`) must include `PREVIEW_VERIFICATION_KEY` or the server rejects them.

**Configuration is runtime, not build-time.** The client receives `dcsReadOnlyToken` and `previewVerificationKey` from `GET /api/config` (served by `server/routes/config.js` from env vars). Do **not** introduce `VITE_*`/`import.meta.env` config for these — there is intentionally none in active source. Env vars: `PORT`, `CACHE_DIR`, `DCS_READ_ONLY_TOKEN`, `PREVIEW_VERIFICATION_KEY` (see `.env.example`).

## Conventions

- **Path aliases** (defined in `vite.config.js` + `jsconfig.json`): `@common`, `@components`, `@hooks`, `@helpers`, `@renderer`, `@utils` → `src/<name>`. Prefer these over relative imports.
- Function components only; 2-space indent, single quotes. Components are `PascalCase.jsx` in `src/components`; hooks are `useXxx.jsx` in `src/hooks`; pure utilities live in `src/helpers`.
- **Two entry points:** `src/main.jsx` → `App` is the live preview app (the only one `index.html` loads). `src/catalog-main.jsx` → `CatalogApp` is a separate catalog-browsing entry.
- ESLint **ignores** `dist`, `netlify`, `server/`, and `src/utils/translationNotesRenderer.js` (see `.eslintrc.cjs`) — lint won't catch issues in those.
- DCS servers (`src/common/constants.js`): `prod`=git.door43.org, `qa`=qa.door43.org, `dev`=develop.door43.org. Chosen by `?server=` then hostname, defaulting to **QA** in local dev.
- URL query params handled in `App.context`: `book` (accepts ranges/lists like `ot`, `nt`, `all`, `gen,exo`), `chapters`, `server`, `token`, `editor`/`edit` (forces no-cache), `nocache`/`no-cache`, `rerender`/`force-render`. Hash anchors (e.g. `#gen-1-1`, `#obs-1`) drive in-document navigation; `App.context` also rewrites legacy `*.html` door43.org links.

## Documentation drift (important)

`AGENTS.md` and `ARCHITECHTURE.md` (Sept 2025) describe a **superseded** Netlify + S3 deployment with `VITE_*` build-time env vars and Netlify Functions. That stack has been replaced by the **Express server + `/api/config` runtime config + filesystem cache** described above. The **`README.md`** (Dec 2025) and `DOCKER_DEPLOYMENT.md` are current; trust them over `AGENTS.md`/`ARCHITECHTURE.md` for build, deploy, env, and caching details. The coding-style and PR guidance in `AGENTS.md` is still valid.
