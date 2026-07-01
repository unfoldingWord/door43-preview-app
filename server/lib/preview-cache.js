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

export function cacheKey({ owner, repo, sha, media, books }) {
  const canon = [
    owner,
    repo,
    sha,
    media,
    (books || []).join(','),
    CACHE_VERSION,
  ].join('|');
  return createHash('sha256').update(canon).digest('hex');
}

export async function getCached(key) {
  try {
    return await fs.readFile(path.join(PREVIEW_DIR, `${key}.html`), 'utf8');
  } catch {
    return null; // miss (not found) — treat any read error as a miss
  }
}

export async function setCached(key, html) {
  await fs.mkdir(PREVIEW_DIR, { recursive: true });
  const file = path.join(PREVIEW_DIR, `${key}.html`);
  // Write to a temp file then rename so a concurrent reader never sees a partial file.
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, html, 'utf8');
  await fs.rename(tmp, file);
}
