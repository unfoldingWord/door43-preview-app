"""weasyprint-service — a tiny "HTML -> PDF" HTTP service.

Contract (same as the door43-preview-renderers `pdfServiceUrl`):
    POST /          Content-Type: text/html, body = a complete HTML document
                    -> 200 application/pdf (the rendered PDF bytes)
    GET  /health    -> 200 "ok"

It renders with WeasyPrint's Python API (no subprocess). It is meant to sit on a
private network behind the door43-preview-app `/api/weasyprint` proxy route, so it
does not do CORS itself — the Express app owns the public surface and its CORS.

Baked images: OBS renders reference ~600 story images on cdn.door43.org. Fetching
those over the network per document is slow, so the image set is baked into the
container (see Dockerfile) and served from disk here via a WeasyPrint url_fetcher,
matched by filename (so the resolution in the URL doesn't matter). Anything not
baked — TA diagrams, fonts — falls back to the normal network fetch. With no baked
dir present (e.g. local dev) everything just falls back, so behaviour is unchanged.

Env: PORT (8080), MAX_BODY_BYTES (32 MiB), OBS_IMAGES_DIR (/opt/obs-images).
"""

import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from weasyprint import HTML, default_url_fetcher

PORT = int(os.environ.get("PORT", "8080"))
MAX_BODY_BYTES = int(os.environ.get("MAX_BODY_BYTES", str(32 * 1024 * 1024)))
OBS_IMAGES_DIR = os.environ.get("OBS_IMAGES_DIR", "/opt/obs-images")

_MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif"}


def _index_local_images(root):
    """Map basename -> absolute path for every image under root (recursive)."""
    idx = {}
    if os.path.isdir(root):
        for dirpath, _dirs, files in os.walk(root):
            for name in files:
                if os.path.splitext(name)[1].lower() in _MIME:
                    idx.setdefault(name, os.path.join(dirpath, name))
    return idx


LOCAL_IMAGES = _index_local_images(OBS_IMAGES_DIR)


def obs_url_fetcher(url):
    """Serve baked door43 CDN images from disk (by filename); else fetch normally."""
    if url.startswith("https://cdn.door43.org/"):
        name = url.rsplit("/", 1)[-1].split("?")[0]
        path = LOCAL_IMAGES.get(name)
        if path:
            with open(path, "rb") as handle:
                data = handle.read()
            ext = os.path.splitext(name)[1].lower()
            return {"string": data, "mime_type": _MIME.get(ext, "application/octet-stream")}
    return default_url_fetcher(url)


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, content_type="text/plain; charset=utf-8"):
        data = body if isinstance(body, (bytes, bytearray)) else str(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def do_GET(self):
        if self.path in ("/health", "/"):
            self._send(200, "ok")
        else:
            self._send(404, "not found")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return self._send(400, "empty body - POST a complete HTML document")
        if length > MAX_BODY_BYTES:
            return self._send(413, "payload too large")

        html = self.rfile.read(length).decode("utf-8")
        try:
            pdf = HTML(string=html, url_fetcher=obs_url_fetcher).write_pdf()
        except Exception as exc:  # noqa: BLE001 - report any render failure to the caller
            return self._send(500, f"weasyprint failed: {exc}")

        self._send(200, pdf, "application/pdf")

    def log_message(self, *args):  # quieter default logging
        pass


def main():
    print(
        f"weasyprint-service listening on :{PORT} "
        f"(baked images: {len(LOCAL_IMAGES)} from {OBS_IMAGES_DIR})",
        flush=True,
    )
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
