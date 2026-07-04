# Door43 Preview

![unfoldingWord](images/uW.png)

[![Node >= 22](https://img.shields.io/badge/Node-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm >= 10](https://img.shields.io/badge/pnpm-%3E%3D10-f69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![React 18](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=061d2a)](https://react.dev/)
[![Vite 7](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

### Web & Print Preview for Door43 Content Service

Preview and print unfoldingWord Bible translations, translation helps, and Open
Bible Stories from the [Door43 Content Service (DCS)](https://qa.door43.org) — as
interactive **web** pages or downloadable **PDFs**.

**Live App:** [https://preview.door43.org](https://preview.door43.org)

[Report Bug](https://github.com/unfoldingWord-box3/door43-preview-app/issues) ·
[Request Feature](https://github.com/unfoldingWord-box3/door43-preview-app/issues)

---

## About

Door43 Preview is a **server-rendered** preview service. The Express server renders
resources to HTML using the shared
[`@unfoldingword/door43-preview-renderers`](https://www.npmjs.com/package/@unfoldingword/door43-preview-renderers)
library and delegates HTML→PDF to a small **WeasyPrint** sidecar. The React client
(`src/rebuild/PreviewApp.jsx`) is thin — it drives an `<iframe>` pointed at the
server's `/api/preview/*` routes and never renders resource content itself.

Rendered output (htmlData, nav trees, PDFs) is **cached and content-addressed** by a
composite identity of everything a render uses, so repeat views are instant and PDFs
can be pre-generated ("warmed") for releases.

> **Operators & maintainers:** see **[docs/OPERATIONS.md](docs/OPERATIONS.md)** for the
> architecture diagram, the full environment-variable reference, queue/priority and
> cache-warming details, and step-by-step **local / QA / production (Puppet)** setup.

![Door43 Preview Screenshot](./images/screenshot.png)

---

## Features

- **Resource browsing** — search DCS by language, subject, and owner; pick a version
  (branch, tag, or latest release) and a book.
- **Web preview** — server-rendered HTML with chapter/verse navigation; a moved branch
  is served instantly from the last render while it revalidates ("serve-stale").
- **PDF preview** — server-rendered via WeasyPrint on an async queue; configurable page
  size and columns. OBS story images are baked into the sidecar for fast renders.
- **Caching** — disk (dev) or S3 (prod), keyed on a composite identity so a book only
  re-renders when content it actually uses changes.
- **Cache warming** — an endpoint + optional cron to pre-render all of a resource's
  PDFs (per book + whole) for attaching to releases.
- **Multi-instance** — read from PROD / QA / DEV DCS via `?server=` or `DCS_HOST`.
- **Docker-ready** — app + WeasyPrint sidecar via Docker Compose.

---

## Quick Start

**Hosted:** open [https://preview.door43.org](https://preview.door43.org), search a
resource, pick a version/book, and choose Web or PDF. For local setup, read on.

---

## Development

### Prerequisites

- **Node.js** >= 22 (`.nvmrc` pins 22; use [nvm](https://github.com/nvm-sh/nvm))
- **pnpm** >= 10 (`npm i -g pnpm` or `corepack enable`)
- **Docker** (optional — for the WeasyPrint sidecar and full-stack runs)

### Setup

```bash
pnpm install
cp .env.example .env     # only DCS_READ_ONLY_TOKEN / PREVIEW_VERIFICATION_KEY usually need values
```

`.env.example` is a grouped, commented template of every setting; most have sensible
defaults. See [docs/OPERATIONS.md §9](docs/OPERATIONS.md) for the full reference.

### Running locally

```bash
# 1. WeasyPrint sidecar (only needed for PDFs)
docker compose up -d weasyprint       # or point WEASYPRINT_SERVICE_URL at any sidecar

# 2. API server on :3000 (renders HTML, caches to ./cached-files, in-process queue)
pnpm dev:server                       # add DEBUG_MODE=1 for verbose logs

# 3. Vite client on :5173 (proxies /api → :3000)
pnpm dev
```

Open **http://localhost:5173**. Defaults: DCS = **QA**, cache = **disk**, queue =
**in-process**, crons **off**. Add `?debug=1` to the URL for verbose client logs.
`pnpm cache:clean` clears the disk cache. To run everything in containers instead:
`docker compose up --build` (app on :3000).

### Building for production

```bash
pnpm build     # → dist/ (the thin client; ~435 KB JS, ~140 KB gzipped)
pnpm start     # NODE_ENV=production Express: serves dist/ + the API on :3000
```

---

## Deployment

Runs as two containers (app + WeasyPrint sidecar; Redis optional for the BullMQ
queue). The **[docs/OPERATIONS.md](docs/OPERATIONS.md)** guide covers local, **QA**
(qa.door43.org), and **Puppet production** (git.door43.org / preview.door43.org),
including S3 caching, a dedicated worker container, cron activation, and secrets.

```bash
docker compose up -d --build     # app on :3000; weasyprint internal
```

---

## Architecture (short)

```
browser (thin SPA) ──HTTP──▶ app (Express + renderers lib) ──▶ DCS (Gitea)
                             │  caches htmlData/nav/PDF (disk|S3)
                             │  PDF job queue (in-process|BullMQ)
                             └──POST html──▶ weasyprint sidecar ──▶ PDF
```

Full diagram, request lifecycle, caching model, and queue/priority: **[docs/OPERATIONS.md](docs/OPERATIONS.md)**.

---

## Project Structure

```
door43-preview-app/
├── src/
│   ├── rebuild/PreviewApp.jsx    # the active thin client (mounted by main.jsx)
│   ├── main.jsx                  # client entry
│   ├── utils/debug.js            # client DEBUG logging (?debug=1)
│   └── (components/, hooks/, …)  # legacy client tree — retained for salvage, unmounted
├── server/
│   ├── index.js                  # Express app: routes + SPA fallback
│   ├── routes/                   # render-html, render-pdf, nav, preview-status, warm,
│   │                             #   catalog, weasyprint, config, (legacy cache routes)
│   └── lib/                      # render-identity, html-data, preview-cache + cache-{disk,s3},
│                                 #   job-queue*, warm + warm-cron, dcs-host, log
├── weasyprint-service/           # HTML→PDF sidecar (Dockerfile bakes OBS images)
├── docs/OPERATIONS.md            # operations & deployment guide
├── docker-compose.yml            # app + weasyprint (+ optional redis)
├── Dockerfile                    # app image
└── .env.example                  # configuration template
```

---

## API Endpoints

Core (rebuild):

| Method / path | Purpose |
|---|---|
| `GET /api/preview/html?<descriptor>` | Render/serve a resource's web HTML (cached, serve-stale). |
| `GET /api/preview/nav?owner&repo&ref&book` | Chapter/verse tree for a book. |
| `GET /api/preview/status?<descriptor>` | Is the cached web view current? (drives the "updating…" banner) |
| `POST /api/preview/pdf` | Enqueue a PDF render → `{ jobId, state }`. |
| `GET /api/preview/pdf/:jobId` | PDF job status. |
| `GET /api/preview/pdf?<descriptor>` | Serve the cached PDF (miss → `503` + enqueue). |
| `GET /api/warm?owner&repo&ref&token` | Warm all of a resource's PDFs into cache (token-gated). |
| `GET /api/catalog/{search,tags,branches,entry}` | Catalog browsing / version pickers. |
| `POST /api/weasyprint` | HTML→PDF proxy to the sidecar (CORS surface). |
| `GET /api/config`, `GET /health` | Client runtime config; health check. |

Descriptor params: `owner`, `repo`, `ref`, `books`, `pageSize`, `columns`, `server`.
(`/api/save-html-to-cache`, `/api/get-cached-html`, `/api/cached-page` remain from the
legacy client and are unused by the rebuild.)

---

## Available Scripts

```bash
pnpm dev            # Vite dev server (:5173, proxies /api → :3000)
pnpm dev:server     # Express server only (:3000)
pnpm build          # production build → dist/
pnpm preview        # serve the built dist/ (:4173)
pnpm start          # production Express (dist/ + API, :3000)
pnpm lint           # ESLint
pnpm cache:clean    # clear the disk cache
pnpm docker:compose # docker compose up -d --build
```

---

## Key Technologies

- **React 18 + Vite 7** — thin client + build.
- **Express** — API + static serving.
- **@unfoldingword/door43-preview-renderers** — resource → HTML / paged PDF HTML.
- **WeasyPrint** — HTML→PDF sidecar.
- **BullMQ + Redis** (optional) — persistent, multi-worker PDF queue.
- **Docker + Chainguard** — hardened container images.

---

## Contributing

See [AGENTS.md](./AGENTS.md) (structure, style, commands, PR checklist) and
[CONTRIBUTING.md](./CONTRIBUTING.md). Run `pnpm lint` and `pnpm build` before opening a PR.

## License

MIT — see [LICENSE](./LICENSE).

## Links

- **Live App:** https://preview.door43.org
- **DCS:** https://git.door43.org (prod) · https://qa.door43.org (QA)
- **GitHub:** https://github.com/unfoldingWord-box3/door43-preview-app
- **Discord:** [Open Components Ecosystem](https://discord.com/channels/867746700390563850/1019675732324143205)
