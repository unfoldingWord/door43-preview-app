// Content-addressed cache for rendered preview HTML.
//
// Pluggable by design: a disk backend now (reuses the app's CACHE_DIR), so we can
// build and test without AWS; an S3 backend drops in behind the same
// getCached/setCached interface once the openbao creds land.
//
// The key is derived from the resolved commit SHA (not the moving ref), so it
// auto-invalidates when the resource content changes, and CACHE_VERSION lets us
// invalidate everything on a renderer upgrade.
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const CACHE_DIR = process.env.CACHE_DIR || path.resolve(process.cwd(), 'cache');
const PREVIEW_DIR = path.join(CACHE_DIR, 'preview');

// Bump (or set env) when the renderer output format changes in a way that should
// invalidate all cached HTML — e.g. a @unfoldingword/door43-preview-renderers upgrade.
export const CACHE_VERSION = process.env.PREVIEW_CACHE_VERSION || 'r1';

export function cacheKey({ owner, repo, sha, media, books, pageSize, columns }) {
  const canon = [
    owner,
    repo,
    sha,
    media,
    (books || []).join(','),
    pageSize || '', // PDF-only; empty for HTML
    columns == null ? '' : String(columns), // PDF-only
    CACHE_VERSION,
  ].join('|');
  return createHash('sha256').update(canon).digest('hex');
}

// get/set handle both text (HTML, utf8 string) and binary (PDF, Buffer) via the
// `ext`/`binary` options, so one content-addressed store serves both artifacts.
export async function getCached(key, { ext = 'html', binary = false } = {}) {
  try {
    return await fs.readFile(
      path.join(PREVIEW_DIR, `${key}.${ext}`),
      binary ? undefined : 'utf8'
    );
  } catch {
    return null; // miss (not found) — treat any read error as a miss
  }
}

export async function setCached(key, data, { ext = 'html' } = {}) {
  await fs.mkdir(PREVIEW_DIR, { recursive: true });
  const file = path.join(PREVIEW_DIR, `${key}.${ext}`);
  // Write to a temp file then rename so a concurrent reader never sees a partial file.
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}
