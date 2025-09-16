# Deployment (Netlify)

## Overview
This app is a Vite + React SPA deployed to Netlify. Production builds publish the `dist/` folder and use SPA redirects per `netlify.toml`.

## Prerequisites
- Netlify account and CLI: `npm i -g netlify-cli`
- Node >= 18, pnpm >= 8

## Environment Variables
Set these in the Netlify UI (Site settings → Environment):
- `VITE_DCS_READ_ONLY_TOKEN` (optional: for authenticated catalog access if needed)
- `VITE_PREVIEW_S3_BUCKET_NAME` (e.g., `dev-preview.door43.org`)
- `VITE_PREVIEW_VERIFICATION_KEY` (must match client/server if used)

Never store secrets in the repo. Use `.env` locally for development only.

## Local Emulation
- Install deps: `pnpm install`
- Run: `pnpm netlify-dev` (reads `netlify.toml`)

## Production Deploy
1. Connect the repo to Netlify or use CLI:
   - `netlify init` (link to an existing site or create one)
2. Build command: `vite build`
3. Publish directory: `dist`
4. Deploy from CLI (optional):
   - Preview: `netlify deploy --build --message "preview"`
   - Production: `netlify deploy --prod --build --message "prod"`

## Notes
- SPA redirect and CORS headers are defined in `netlify.toml`.
- If adding functions, place them in `netlify/functions` and ensure build includes them.
