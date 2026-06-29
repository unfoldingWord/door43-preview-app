# weasyprint-service — HTML -> PDF, on a hardened Chainguard (Wolfi) Python base.
#
# WeasyPrint is a Python library with a native stack (Pango / cairo / gdk-pixbuf /
# harfbuzz / fontconfig). Wolfi is glibc-based, so it runs the same as on Debian.
# We use the `:latest-dev` variant because it ships `apk` + a shell to install
# that native stack — it is still a low-CVE Chainguard image, not a generic distro.
#
# ⚠️ Authored without registry access — confirm with a real `docker build`:
#   - exact Wolfi apk package names (`apk search pango cairo gdk-pixbuf …` in a
#     `cgr.dev/chainguard/wolfi-base:latest-dev` shell);
#   - that the `nonroot` user exists in this image.
# A smaller distroless multi-stage build is possible, but the minimal runtime
# stage must also carry WeasyPrint's native .so libs (not just the Python venv) —
# see README.md.
FROM cgr.dev/chainguard/python:latest-dev

USER root

# Native deps for WeasyPrint + a base font. cairo / glib / harfbuzz come in as
# transitive deps of pango / gdk-pixbuf.
RUN apk add --no-cache pango gdk-pixbuf fontconfig font-dejavu \
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

CMD ["python", "server.py"]
