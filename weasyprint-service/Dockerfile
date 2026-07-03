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

# OBS story images, baked into their own layer so WeasyPrint renders OBS PDFs
# without fetching ~600 images per document over the network (the slow part).
# server.py resolves cdn.door43.org/obs/... to these local files by filename, so
# the resolution segment in the URL is irrelevant. This layer is rebuilt only when
# OBS_IMAGES_URL changes (the set changes rarely) — requirements/server.py edits
# keep it cached. Override the resolution at build: --build-arg OBS_IMAGES_URL=...
ARG OBS_IMAGES_URL=https://cdn.door43.org/obs/jpg/obs-images-720px.zip
RUN apk add --no-cache curl unzip \
 && mkdir -p /opt/obs-images \
 && curl -fSL "$OBS_IMAGES_URL" -o /tmp/obs.zip \
 && unzip -q /tmp/obs.zip -d /opt/obs-images \
 && rm -f /tmp/obs.zip

WORKDIR /app
COPY requirements.txt ./
RUN /venv/bin/pip install --no-cache-dir -r requirements.txt
COPY server.py ./

ENV PATH="/venv/bin:$PATH" \
    PORT=8080 \
    OBS_IMAGES_DIR=/opt/obs-images
EXPOSE 8080

# Drop privileges for the runtime.
USER nonroot

# Clear the base image's `python` entrypoint, otherwise it prepends to CMD and
# runs `python python server.py` (Python then tries to open a file named "python").
ENTRYPOINT []
CMD ["python", "server.py"]
