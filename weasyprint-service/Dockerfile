# weasyprint-service — HTML -> PDF, on a hardened Chainguard (Wolfi) Python base.
#
# WeasyPrint is a Python library with a native stack (Pango / cairo / gdk-pixbuf /
# harfbuzz / fontconfig). Wolfi is glibc-based, so it runs the same as on Debian.
# We use the `:latest-dev` variant because it ships `apk` + a shell to install
# that native stack — it is still a low-CVE Chainguard image, not a generic distro.
#
# A smaller distroless multi-stage build is possible, but the minimal runtime
# stage must also carry WeasyPrint's native .so libs (not just the Python venv) —
# see README.md.
FROM cgr.dev/chainguard/python:latest-dev

USER root

# Native deps for WeasyPrint + a base font. cairo / glib / harfbuzz come in as
# transitive deps of pango / gdk-pixbuf.
RUN apk add --no-cache pango gdk-pixbuf fontconfig ttf-dejavu \
 && python -m venv /venv

WORKDIR /app
COPY requirements.txt ./
RUN /venv/bin/pip install --no-cache-dir -r requirements.txt
COPY server.py ./

ENV PATH="/venv/bin:$PATH" \
    PORT=8080
EXPOSE 8080

# Drop privileges for the runtime.
USER nonroot

# Clear the base image's `python` entrypoint, otherwise it prepends to CMD and
# runs `python python server.py` (Python then tries to open a file named "python").
ENTRYPOINT []
CMD ["python", "server.py"]
