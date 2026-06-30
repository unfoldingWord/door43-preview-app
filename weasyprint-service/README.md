# weasyprint-service

A tiny, stateless **HTML → PDF** service backed by [WeasyPrint](https://weasyprint.org/),
running on a hardened Chainguard (Wolfi) Python base. It lets the preview app —
and the door43-preview-renderers styleguide — produce real WeasyPrint PDFs without
installing the Python/native stack into the app's (Chainguard Node) image.

It renders with WeasyPrint's **Python API** in-process (no subprocess), and is meant
to sit on a **private network** behind the app's `/api/weasyprint` proxy route, so it
does no CORS itself — the Express app owns the public surface and its CORS.

## API

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/` | `Content-Type: text/html` — a complete HTML document | `200 application/pdf` |
| `GET` | `/health` | — | `200 "ok"` |

Env: `PORT` (8080), `MAX_BODY_BYTES` (32 MiB).

## How it fits together

```
browser / styleguide / app  ──POST /api/weasyprint (text/html)──►  Express (door43-preview-app)
                                                                      │  proxies to
                                                                      ▼
                                                          weasyprint-service  ──►  PDF
                                                          (internal, this dir)
```

- `server/routes/weasyprint.js` proxies `POST /api/weasyprint` to this service at
  `WEASYPRINT_SERVICE_URL` (default `http://localhost:8080`; `http://weasyprint:8080`
  under docker-compose).
- The styleguide's Render PDF demo can point its **PDF service URL** at
  `https://preview.door43.org/api/weasyprint`; the library/CLI can pass it as
  `pdfServiceUrl`.

## Run with docker-compose (recommended)

`docker-compose.yml` already defines this as an internal `weasyprint` service and
wires `WEASYPRINT_SERVICE_URL` into the app:

```bash
docker compose up -d --build
```

## Build / run standalone

```bash
docker build -t weasyprint-service weasyprint-service
docker run --rm -p 8080:8080 weasyprint-service

printf '<!doctype html><h1>Hello PDF</h1>' \
  | curl -s -X POST --data-binary @- -H 'Content-Type: text/html' \
    http://localhost:8080 -o out.pdf && file out.pdf
```

## ⚠️ Build verification (authored without registry access)

Confirm these against a real `docker build`:

- **Wolfi package names** — `pango gdk-pixbuf fontconfig font-dejavu` are the
  likely names; verify with `apk search …` in a `cgr.dev/chainguard/wolfi-base:latest-dev`
  shell and add any missing native dep WeasyPrint reports at runtime.
- **`nonroot` user** exists in `cgr.dev/chainguard/python:latest-dev` (or switch to
  the numeric `USER 65532`).

The server itself is verified: running `server.py` under the WeasyPrint interpreter
renders a valid PDF from a `POST`.

### Smaller (distroless) image — optional follow-up

The current Dockerfile is single-stage on the `-dev` image (still low-CVE, but it
carries `apk`/shell). A distroless multi-stage build (build on `…:latest-dev`,
run on `cgr.dev/chainguard/python:latest`) is smaller, but the **runtime** stage
must also carry WeasyPrint's native `.so` libs (Pango/cairo/…), not just the Python
venv — copy them from the build stage and verify with `ldd`.

## Deploy

Any container host: `docker compose` on the EC2 box (behind the existing nginx),
or build/push the image and run it as a second service/task. If exposed directly
(not via the app proxy), add CORS for the calling origin and keep it behind
auth / network limits — it renders arbitrary posted HTML.
