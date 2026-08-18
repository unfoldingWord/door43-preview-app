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
`GET /api/preview/nav` returns the cached chapter/verse tree. `GET /api/preview/html`
and `/api/preview/html-json` are synchronous (no queue): both read the cached htmlData
via `getHtmlData()` (in-flight renders are coalesced), then `/html` composes the final
HTML per request with `renderHTML()` while `/html-json` returns the htmlData JSON as-is.
Only PDF rendering is queued.

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
| `PREVIEW_JOB_LOCK_MS` | `900000` | BullMQ lock held per PDF job. Must exceed the slowest render (see §14). |
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

The API port comes from `PORT` (default 3000) and Vite's `/api` proxy reads the same
value, so moving the API off 3000 needs no config change beyond `.env`.

To run the whole stack in containers instead: `docker compose up --build` (app on
:3000, sidecar internal). To publish the app on a different host port, set
`APP_HOST_PORT` — the container always listens on 3000.

For a **production-like local stack** (dedicated worker + Redis + crons) and for
running against a **DCS on your own machine**, see §15.

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
- **PDF stuck on "Rendering PDF…" forever, but the PDF is in the cache** — the BullMQ
  lock expired mid-render. Look for `STALLED` or `Missing lock for job …` /
  `could not renew lock` in the worker log. The render finishes and caches, but
  `moveToFinished` fails without the lock, so the job never reports `completed` and the
  client polls indefinitely — and the job is re-queued, so it renders a second time for
  nothing. Raise `PREVIEW_JOB_LOCK_MS` above the slowest render (default is now 15 min;
  BullMQ's own default of 30 s is far too low — whole-resource TSV PDFs take minutes).
  Only affects the BullMQ backend; the in-process queue has no locks, which is why this
  never appears in single-container dev.
- **Want detail** — `DEBUG_MODE=1` (server) and `?debug=1` (client).

---

## 15. Local production-like stack + a local DCS

Two things §10 doesn't cover: running the **production topology** (dedicated worker,
Redis-backed queue, crons) on one machine, and pointing it at a **DCS running on that
same machine** instead of QA/PROD. `docker-compose.local.yml` does both.

### 15.1 The port swap

A DCS dev instance owns **3000** (Gitea's default, and its `ROOT_URL`/clone URLs are
built from it), so the **preview app moves to 3001** — the app is the cheaper thing to
move.

| Port | Service |
|---|---|
| 3000 | local DCS (Gitea) |
| 3001 | preview app — `pnpm dev:server`, and the published container port |
| 5173 | Vite dev server (proxies `/api` → `PORT`) |
| 8080 | WeasyPrint sidecar (published by the local overlay) |

The container itself still listens on 3000; only the published port changes
(`APP_HOST_PORT`).

### 15.2 Name the DCS `dcs-local`, not `localhost`

Set `DCS_HOST=http://dcs-local:3000` and make that one name resolve everywhere:

```bash
# host (once) — so the BROWSER resolves it
echo "127.0.0.1  dcs-local" | sudo tee -a /etc/hosts
# containers — docker-compose.local.yml already does this:
#   extra_hosts: ["dcs-local:host-gateway"]
```

This matters because **rendered pages embed absolute DCS URLs** ("Built with" links,
TA diagrams, metadata links). The browser has to resolve the same host the renderer
did. `localhost` breaks inside containers; `host.docker.internal` resolves only inside
containers and leaves dead links in the page. One shared name avoids both.

Make sure DCS listens on all interfaces (Gitea's default — don't set `HTTP_ADDR` to
`127.0.0.1`), or `host-gateway` traffic from the containers won't reach it.

### 15.3 Running it

```bash
# 0. Once: config for this machine.
cp .env.local-dcs.example .env       # or merge its keys into your .env
pnpm install

# 1. Start the local DCS (from your DCS checkout).
./gitea web                          # serves :3000

# 2a. Containers — production topology: app (web) + worker (PDFs + crons) + redis
#     + weasyprint.
pnpm docker:local                    # up -d --build
pnpm docker:local:logs               # follow
pnpm docker:local:down               # stop

# 2b. …or host dev against the same sidecar (faster edit loop, in-process queue):
pnpm dev:server                      # :3001, reads PORT from .env
pnpm dev                             # :5173, proxies /api -> :3001
```

Containers: open **http://localhost:3001**. Host dev: **http://localhost:5173**.

### 15.4 What the overlay changes

| | Base compose | With `docker-compose.local.yml` |
|---|---|---|
| Queue | in-process | **BullMQ on Redis** (persisted to `./redis-data`) |
| PDF rendering | in the web container | **dedicated `worker`** (`PREVIEW_WORKER=on`); web sets `off` |
| Crons | off | **`RUN_CRONS=1` on the worker only** — warming scheduled exactly once |
| DCS | QA | `http://dcs-local:3000` |
| App port | 3000 | 3001 (`APP_HOST_PORT`) |
| Sidecar 8080 | internal (`expose`) | published, so host dev can share it |
| Cache | disk or S3 per `.env` | **forced disk** — a local warm cron must never write a shared bucket |

Warm settings are kept small (`WARM_SEARCH_LIMIT=10`, `WARM_MAX_ENQUEUE_PER_CYCLE=6`,
`WARM_PAGE_SIZES=A4_PORTRAIT`); override any of them in `.env`.

**`WARM_MAX_ENQUEUE_PER_CYCLE` is not a hard cap.** It's checked *between* resources,
after `warmResource()` has already enqueued **all** of one resource's missing PDFs
(`warm-cron.js:63`). One 66-book Bible therefore enqueues ~67 jobs in a single step
regardless of a cap of 6 — the first cycle will build a real backlog. Interactive
requests still cut ahead of it (priority 1 vs 10, §5), waiting only on renders already
in flight. To keep local warming genuinely small, narrow *which* resources are warmed
rather than the cap — e.g. `WARM_SEARCH_QUERY=subject=Open Bible Stories` — or leave
`RUN_CRONS` off unless you're specifically exercising the cron.

### 15.5 Verifying

```bash
curl -s localhost:3001/health
# Catalog reaches the local DCS (should list local prod-stage releases):
curl -s "localhost:3001/api/catalog/search?lang=en&subject=Aligned%20Bible" | head -c 400
# Startup logs should show the local host, the BullMQ backend, and the cron:
pnpm docker:local:logs | grep -E "DCS:|job-queue|warm-cron|preview-cache"
```

Expect `[job-queue] … BullMQ/Redis backend` in both containers, `[warm-cron] every …`
in the **worker only**, and `DCS: http://dcs-local:3000`.

Warming on demand (needs `WARM_TOKEN` from `.env`):

```bash
curl "localhost:3001/api/warm?owner=unfoldingWord&repo=en_ult&ref=v89&token=local-dev-warm-token"
```

### 15.6 Gotchas

- **The local DCS must run MySQL, not SQLite.** DCS builds the catalog `book=` filter
  from MySQL-only SQL — `JSON_SEARCH(...) ... COLLATE utf8mb4_general_ci`
  (`models/catalog_list.go`, `models/door43metadata/search.go`). SQLite has no
  `JSON_SEARCH`, so on a SQLite instance every `catalog/bp?book=…` and
  `catalog/search?book=…` returns **500 `no such function: JSON_SEARCH`**. Since
  `render-identity.js` always appends `?book=` when books are given, **per-book
  previews fail outright** while whole-resource previews still work. This is upstream,
  not an app bug — don't debug it here. No SQLite build tag changes it (`sqlite_json`
  enables JSON1, which still has no `JSON_SEARCH`). Run MySQL 8 to match QA/PROD.
- **The local catalog must have prod-stage entries.** The picker defaults to
  `stage=prod` and the warm cron only searches `stage=prod`. A DCS with repos but no
  releases in the catalog shows an empty picker — that's the data, not the app.
- **Book packages need their dependencies present locally.** Previewing `en_tn` pulls
  `en_ult`/`en_ust`/`el-x-koine_ugnt`/`hbo_uhb`/`en_ta`/`en_tw`; if any is missing from
  the local DCS the render fails on that resource. Mirror the whole set.
- **Cache is namespaced by DCS host**, so local renders land under
  `htmldata/dcs-local:3000/…` and never mix with QA/PROD entries. The `:` in that
  directory name is fine on APFS/ext4 and as an S3 key.
- **DCS's Preview/PDF buttons** link to `<DOOR43_PREVIEW_URL>/u/<owner>/<repo>/<ref>`
  — set `DOOR43_PREVIEW_URL = http://localhost:3001` in your DCS `app.ini` `[dcs]`
  section (note the exact key; `DCS_PREVIEW_URL` is silently ignored and falls back to
  production). Restart DCS after changing it. Those templates only append `?server=`
  for the qa/develop hostnames, so a local DCS sends none — which is why the local app
  needs `DCS_HOST` pointed at it by default.
- **Editing content and want the change to show fast?** Branch staleness lags by
  `REF_SHA_TTL_MS` (15 s); set it to ~3000 locally.
