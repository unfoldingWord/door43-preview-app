"""weasyprint-service — a tiny "HTML -> PDF" HTTP service.

Contract (same as the door43-preview-renderers `pdfServiceUrl`):
    POST /          Content-Type: text/html, body = a complete HTML document
                    -> 200 application/pdf (the rendered PDF bytes)
    GET  /health    -> 200 "ok"

It renders with WeasyPrint's Python API (no subprocess). It is meant to sit on a
private network behind the door43-preview-app `/api/weasyprint` proxy route, so it
does not do CORS itself — the Express app owns the public surface and its CORS.

Env: PORT (8080), MAX_BODY_BYTES (32 MiB).
"""

import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from weasyprint import HTML

PORT = int(os.environ.get("PORT", "8080"))
MAX_BODY_BYTES = int(os.environ.get("MAX_BODY_BYTES", str(32 * 1024 * 1024)))


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
            pdf = HTML(string=html).write_pdf()
        except Exception as exc:  # noqa: BLE001 - report any render failure to the caller
            return self._send(500, f"weasyprint failed: {exc}")

        self._send(200, pdf, "application/pdf")

    def log_message(self, *args):  # quieter default logging
        pass


def main():
    print(f"weasyprint-service listening on :{PORT}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
