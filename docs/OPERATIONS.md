# door43-preview-app — Operations & Developer Guide

How the preview service is put together, how to run it locally, and how it is
deployed to **QA** and **production**. This is the authoritative operational
reference for the rebuilt (Express + Docker) app. (The former Netlify / pre-rebuild
architecture docs have been removed; see `CLAUDE.md` for the code-level map.)

---

## 1. What it is

The app renders unfoldingWord/DCS Bible-translation resources to **web HTML** and
**PDF**. It renders HTML itself using the shared
`@unfoldingword/door43-preview-renderers` library, and delegates HTML→PDF to a small
**WeasyPrint sidecar**. Rendered output is cached and content-addressed, so repeat
views are instant and PDFs can be pre-generated for releases.

```
                                    ?server= / DCS_HOST
                                          │  reads
                                          ▼
  ┌─────────┐   HTTP     ┌───────────────────────────┐   GET /catalog, /git   ┌───────────────┐
  │ browser │ ─────────▶ │  app  (Express + built SPA)│ ─────────────────────▶ │  DCS (Gitea)  │
  │  (SPA)  │ ◀───────── │  • renders HTML (lib)      │ ◀───── USFM/TSV/MD ──── │ qa|git.door43 │
  └─────────┘  html/pdf  │  • caches htmlData + PDF   │                        └───────────────┘
                         │  • PDF job queue           │   POST text/html
                         └──────────┬─────────┬───────┘ ─────────────────┐
                                    │         │                          ▼
                       cache (disk/S3)   PDF render jobs        ┌──────────────────┐
                                    │         │                 │   weasyprint     │
                              ┌─────▼───┐ ┌───▼────────┐  PDF   │   (sidecar)      │
                              │ disk/S3 │ │ in-proc /  │ ◀───── │  + baked OBS imgs│
                              └─────────┘ │ BullMQ+Redis│        └──────────────────┘
                                          └────────────┘
```

**Key idea — the app is the only "smart" piece.** The WeasyPrint sidecar is a dumb,
stateless `HTML → PDF` box (with OBS images baked in so it never fetches them at
render time). Redis is optional. DCS is external and read-only.

---

## 2. Components & where they live

| Component | Path / image | Role |
|---|---|---|
| **App** | `Dockerfile` (repo root) | Express API + built SPA (`dist/`). Renders HTML, caches, runs the PDF queue + warming cron. |
| **SPA (client)** | `src/rebuild/PreviewApp.jsx` | Thin React client — points an `<iframe>` at `/api/preview/html|pdf`. Built by `vite build` → `dist/`. |
| **WeasyPrint sidecar** | `weasyprint-service/` | `POST text/html → application/pdf`. OBS images baked in (see §7). Internal only. |
| **Renderers library** | `@unfoldingword/door43-preview-renderers` (npm dep) | Resource → `htmlData` → HTML / paged PDF HTML. |
| **Cache** | disk volume or S3 | `htmldata/…`, `nav/…`, PDFs, and pointers — content/version-keyed. |
| **Queue** | in-process, or Redis/BullMQ | Async PDF renders with priority. |

Server internals of note (`server/lib/`): `render-identity.js` (composite staleness
key), `html-data.js` (cached htmlData + serve-stale), `preview-cache.js` +
`cache-disk.js`/`cache-s3.js` (cache backends), `job-queue*.js` (queue), `warm.js` +
`warm-cron.js` (warming), `dcs-host.js` (host selection), `log.js` (logging).

---

## 3. Request lifecycle

**Web view** — `GET /api/preview/html?owner&repo&ref&books` → resolve the version and
a **composite identity** (a hash over every resource + book-file the render uses) →
serve cached htmlData on a match; on a moved branch serve the last render immediately
and revalidate in the background (the client shows an "updating…" banner and reloads).
`GET /api/preview/nav` returns the cached chapter/verse tree.

**PDF** — `POST /api/preview/pdf` enqueues a render (deduped by cache key) and returns
a `jobId`; the client polls `GET /api/preview/pdf/:jobId`; when complete it points the
iframe at `GET /api/preview/pdf?<descriptor>`, which streams the cached PDF. A miss on
that GET does **not** block — it enqueues (interactive priority) and returns `503` +
`Retry-After` (see §5).

---

## 4. Caching model

- **What:** `htmlData` JSON (not final HTML — so `renderHTML` options and PDF assembly
  are per-request), the nav tree, and PDF bytes.
- **Staleness = composite identity.** A book only goes stale when content it actually
  renders from changes (its ULT/UST/UGNT/UHB book file, TW, TA, …), not on unrelated
  commits. Tag refs are immutable → cached ~24 h; branch refs re-check every
  `REF_SHA_TTL_MS` (15 s default).
- **Backend:** disk (`CACHE_DIR`) for dev; **S3** (`AWS_S3_BUCKET`) for QA/prod.
  Namespaced by DCS host, so a `?server=QA` request never serves prod-cached content.
- **Invalidation:** bump `PREVIEW_CACHE_VERSION` (already bumped on renderer upgrades).

---

## 5. Queueing & priority — user requests always come first

PDF renders run on a queue (in-process, or BullMQ if `REDIS_URL` is set) with
`PREVIEW_JOB_CONCURRENCY` workers (default 2). Every job has a **priority (lower runs
sooner)**:

| Source | Priority |
|---|---|
| Interactive — `POST /api/preview/pdf`, and a miss on the serve URL | **1** |
| Warm / cron | **10** |

So **a user's PDF is always dequeued before any warm/cron backlog.** Specifics:

- **User-before-cron:** an interactive request jumps ahead of every queued warm job.
  It waits at most for a render already in flight (≤ concurrency slots), never for the
  whole warm backlog.
- **User-before-user:** interactive requests share priority 1 and run **FIFO** among
  themselves — first come, first served.
- **Bump on demand:** if a user requests a PDF that's *already* queued as a warm job,
  it's **promoted to interactive** and moves up (in-process: re-inserted; BullMQ:
  `changePriority`). No duplicate render.
- **Non-blocking serve:** `GET /api/preview/pdf?<descriptor>` on a miss returns `503`
  + `Retry-After` and enqueues at interactive priority — it never renders synchronously
  in the request, so it can't tie up a connection behind cron work.

This is the protection you asked about: cron can fill the cache continuously and a
user request still cuts to the front.

---

## 6. Cache warming & cron

Warming pre-renders PDFs (per book × page size, plus a whole-resource PDF except for
huge TSV Translation Notes) so first views and release downloads are never cold.
Rendering a PDF also warms its htmlData, so the web view benefits too.

- **On-demand:** `GET /api/warm?owner&repo&ref&token=<WARM_TOKEN>` — enqueues anything
  not already cached and returns a manifest with a stable serve URL per PDF. Idempotent
  — poll the same URL to watch progress; when `state:"done"`, collect the URLs (e.g. to
  attach to a release). Token-gated: no `WARM_TOKEN` set → `503`; wrong token → `401`.
- **Scheduled (cron):** gated by the master switch **`RUN_CRONS=1`** — without it the
  container runs no crons and warms nothing on its own. With it plus
  `WARM_INTERVAL_MS`, each cycle lists the latest releases
  (`catalog/search?stage=prod`) and tops up missing PDFs, paced by
  `WARM_MAX_ENQUEUE_PER_CYCLE` so the first cycle can't flood the queue. All warm jobs
  are priority 10 (see §5).

**Jobs that run today:** just the warming cron. Add future crons the same way — behind
`RUN_CRONS` — in `server/lib/warm-cron.js`/a sibling, started from `server/index.js`.

---

## 7. WeasyPrint sidecar & OBS images

OBS renders reference ~600 story images on `cdn.door43.org`; fetching them per PDF is
slow. The set is **baked into the sidecar image** (`weasyprint-service/Dockerfile`, a
cached layer) and served from disk by `server.py`'s `url_fetcher`, matched by filename
(the resolution in the URL is irrelevant). Non-baked images (TA diagrams, fonts) still
fetch normally. Default set is 720p (~206 MB); override:

```bash
docker compose build --build-arg OBS_IMAGES_URL=https://cdn.door43.org/obs/jpg/obs-images-360px.zip weasyprint
# or set OBS_IMAGES_URL in .env (compose reads it)
```

---

## 8. Logging (DEBUG / VERBOSE)

One switch controls verbosity on each side.

- **Server:** `DEBUG_MODE=1` (or `VERBOSE_MODE=1`).
  - **Off (default):** startup, queue/cache backend, cron cycle start/stop + summaries,
    each PDF render start/stop, and **warnings/errors** (e.g. a failed render).
  - **On:** all of the above **plus** the per-request access log, cache HIT/MISS
    timings, what's downloaded, and per-resource warm detail.
- **Client:** add `?debug=1` to the URL (persists in `localStorage`; `?debug=0` clears
  it). On → the browser console logs what's fetched/rendered (nav, web view, PDF job,
  freshness); off → quiet.

Implementation: `server/lib/log.js` (`log.debug/info/warn/error`) and
`src/utils/debug.js` (`dbg`).

---

## 9. Environment variables

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | App port. |
| `NODE_ENV` | — | `production` also serves the built SPA from `dist/`. |
| `CACHE_DIR` | temp dir | Disk cache location (disk backend). |
| `DCS_HOST` | auto | `PROD`/`QA`/`DEV` or a bare origin. Auto = QA, or PROD when served on `preview.door43.org`. Per-request `?server=` overrides. |
| `DCS_READ_ONLY_TOKEN` | — | Optional DCS read token. |
| `PREVIEW_VERIFICATION_KEY` | random | Cache-upload shared secret; set it in shared envs. |
| `WEASYPRINT_SERVICE_URL` | `http://localhost:8080` | Sidecar URL (compose sets `http://weasyprint:8080`). |
| `OBS_IMAGES_URL` | 720p zip | **Build-arg** for the sidecar image. |
| `PREVIEW_CACHE_BACKEND` | auto | `disk`\|`s3`. Auto = S3 if `AWS_S3_BUCKET` set, else disk. |
| `AWS_S3_BUCKET` / `AWS_REGION` / `AWS_S3_PREFIX` | — / `us-west-2` / `preview-cache` | S3 cache. Creds via env/role. |
| `REDIS_URL` (or `REDIS_HOST`/`PORT`/`DB`) | — | Set → BullMQ queue; unset → in-process. |
| `PREVIEW_JOB_CONCURRENCY` | `2` | Concurrent PDF renders. |
| `PREVIEW_WORKER` | on | `off` → this container doesn't process jobs (a dedicated worker does). |
| `DEBUG_MODE` / `VERBOSE_MODE` | off | Verbose server logs (§8). |
| `RUN_CRONS` | off | **Master switch** for all crons. |
| `WARM_TOKEN` | — | Required to use `/api/warm`. |
| `WARM_INTERVAL_MS` | — | Schedules the warm cron (needs `RUN_CRONS=1`). |
| `WARM_DCS_HOST` | app default | Which DCS the cron warms from. |
| `WARM_MAX_ENQUEUE_PER_CYCLE` | `200` | Per-cycle enqueue cap (pacing). |
| `WARM_SEARCH_LIMIT` / `WARM_SEARCH_QUERY` | `100` / — | Catalog search scope. |
| `WARM_PAGE_SIZES` | `A4_PORTRAIT,US_LETTER_PORTRAIT` | Page sizes to warm. |
| `WARM_FIRST_DELAY_MS` / `WARM_ENUM_CONCURRENCY` | `10000` / `8` | Cron first-run delay / book-enumeration concurrency. |
| `REF_SHA_TTL_MS` / `REF_SHA_TAG_TTL_MS` | `15000` / `86400000` | Branch / tag ref→sha cache TTL. |
| `PREVIEW_CACHE_VERSION` | `r2` | Renderer-output cache-buster. |

See `.env.example` for a copy-paste template.

---

## 10. Running locally (development)

```bash
pnpm install

# 1. WeasyPrint sidecar (needed only for PDF). Either run just the container:
docker compose up -d weasyprint          # publishes nothing; use the host mapping below
#    …or point at any reachable sidecar with WEASYPRINT_SERVICE_URL.

# 2. API server (:3000) — renders HTML, caches to ./cached-files, in-process queue.
pnpm dev:server

# 3. Client dev server (:5173) — Vite proxies /api → :3000.
pnpm dev
```

Open http://localhost:5173. Defaults: DCS = **QA**, cache = **disk**, queue =
**in-process**, crons **off**. Turn on verbose logs with `DEBUG_MODE=1 pnpm dev:server`
and `?debug=1` in the browser. `pnpm cache:clean` clears the disk cache.

To run the whole stack in containers instead: `docker compose up --build` (app on
:3000, sidecar internal).

---

## 11. QA deployment (reads qa.door43.org)

QA runs the same containers, reading from **QA DCS** and using **S3** for a shared,
durable cache. Recommended `.env` on the QA host:

```bash
NODE_ENV=production
DCS_HOST=QA                      # or leave unset; default is QA
PREVIEW_CACHE_BACKEND=s3
AWS_S3_BUCKET=<qa-preview-bucket>
AWS_REGION=us-west-2
PREVIEW_VERIFICATION_KEY=<shared>
WARM_TOKEN=<shared>              # if warming from QA
# RUN_CRONS=1 + WARM_INTERVAL_MS=3600000   # optional: keep QA hot / exercise the cron
# DEBUG_MODE=1                             # optional while validating
```

Bring it up with `docker compose up -d --build`. The app is on :3000 (front it with
your reverse proxy / TLS). To exercise BullMQ on QA, uncomment the `redis` service in
`docker-compose.yml` and set `REDIS_URL=redis://redis:6379`.

---

## 12. Production deployment (Puppet, git.door43.org)

Production is Puppet-managed and served at **preview.door43.org**, reading from
**PROD DCS** (`git.door43.org` — auto-selected from the hostname, so `DCS_HOST` is
optional). What Puppet must provide:

1. **Containers** — run `app` + `weasyprint` from `docker-compose.yml` (or the images
   built from `Dockerfile` / `weasyprint-service/Dockerfile`). For throughput, run a
   **dedicated worker**: a second `app` container with `PREVIEW_WORKER=on` while the
   web container sets `PREVIEW_WORKER=off`, both sharing `REDIS_URL` (enable the
   `redis` service). Otherwise the single container processes jobs in-process.
2. **Secrets from openbao** — Puppet injects into the app env: `AWS_ACCESS_KEY_ID`,
   `AWS_SECRET_ACCESS_KEY`, `PREVIEW_VERIFICATION_KEY`, `WARM_TOKEN`,
   `DCS_READ_ONLY_TOKEN` (if used).
3. **Cache** — `PREVIEW_CACHE_BACKEND=s3` + `AWS_S3_BUCKET` (durable, shared across
   containers). Don't rely on a disk volume in prod.
4. **Cron** — set **`RUN_CRONS=1`** + `WARM_INTERVAL_MS` + `WARM_DCS_HOST=PROD` on
   **exactly one** container (the web or a dedicated cron container) so warming runs
   once, not per replica. Leave `RUN_CRONS` unset everywhere else.
5. **OBS images** — baked at image build (`OBS_IMAGES_URL`); no runtime volume needed.
6. **Logging** — leave `DEBUG_MODE` unset in prod (lifecycle + warnings/errors only);
   flip it on temporarily to investigate.

Representative production env:

```bash
NODE_ENV=production
# DCS_HOST=PROD                  # optional; auto on preview.door43.org
PREVIEW_CACHE_BACKEND=s3
AWS_S3_BUCKET=<prod-preview-bucket>
AWS_REGION=us-west-2
REDIS_URL=redis://redis:6379     # if using a worker container
PREVIEW_JOB_CONCURRENCY=2
# on the web container:   PREVIEW_WORKER=off
# on the worker/cron one: PREVIEW_WORKER=on  RUN_CRONS=1  WARM_INTERVAL_MS=3600000  WARM_DCS_HOST=PROD
# secrets (openbao): AWS_*, PREVIEW_VERIFICATION_KEY, WARM_TOKEN
```

---

## 13. Warming PDFs for a release

```bash
# Trigger (idempotent) and poll until done:
curl "https://preview.door43.org/api/warm?owner=unfoldingWord&repo=en_ult&ref=v88&token=$WARM_TOKEN"
# -> { version, total, cached, pending, state, items:[{ label, pageSize, cached, url }, …] }
```

When `state:"done"`, each `item.url` (`/api/preview/pdf?…`) serves the cached PDF —
collect them for the release. An un-warmed URL returns `503` + `Retry-After` and queues
itself (interactive priority), so a retry shortly after succeeds.

---

## 14. Troubleshooting

- **PDF requests hang / slow OBS** — confirm the sidecar baked its images: its startup
  log says `baked images: N from /opt/obs-images`. `N` of 0 means the build didn't fetch
  the zip (check `OBS_IMAGES_URL` / build network).
- **Everything re-renders** — a `PREVIEW_CACHE_VERSION` bump (expected on renderer
  upgrades) or a wrong/empty S3 bucket. Check the `[preview-cache] backend:` startup log.
- **Stale content lingers** — branch detection lags by `REF_SHA_TTL_MS` (15 s); lower it
  for snappier testing. Tags are cached 24 h by design.
- **Cron warming nothing** — `RUN_CRONS` not set, or `WARM_INTERVAL_MS` missing. Startup
  logs `[warm-cron] every …` when active.
- **`node: Cannot find package` after a crash/disk-full** — the pnpm link tree was
  damaged; `pnpm install` relinks it from the store.
- **Want detail** — `DEBUG_MODE=1` (server) and `?debug=1` (client).
