// Content-addressed cache for rendered preview artifacts (HTML JSON, PDF).
//
// Pluggable backend, selected by env:
//   AWS_S3_BUCKET set -> S3 (shared, durable; prod)
//   otherwise         -> local disk (dev, no infra)
// Both expose the same async get/set: getCached(key,{ext,binary}) / setCached(key,data,{ext}).
//
// CACHE_VERSION invalidates everything on a renderer-output change (the cache key
// doesn't include the renderer version).
import { createHash } from 'crypto';
import * as disk from './cache-disk.js';
import * as s3 from './cache-s3.js';

// Bump on renderer-output changes. r2: door43-preview-renderers 1.5.2 anchors
// Psalm superscriptions (-front).
export const CACHE_VERSION = process.env.PREVIEW_CACHE_VERSION || 'r2';

// Backend: PREVIEW_CACHE_BACKEND=disk|s3 forces it; otherwise S3 when AWS_S3_BUCKET
// is set, else disk. Use disk for local dev — reading cached objects from S3 over a
// slow link is slower than re-rendering; S3 belongs in prod where bandwidth is real.
const forced = process.env.PREVIEW_CACHE_BACKEND;
const useS3 = forced ? forced === 's3' : !!process.env.AWS_S3_BUCKET;
const backend = useS3 ? s3 : disk;
console.log(
  `[preview-cache] backend: ${
    useS3
      ? `S3 (${process.env.AWS_S3_BUCKET} @ ${process.env.AWS_REGION || 'us-west-2'})`
      : `disk — ${disk.CACHE_DIR} (temporary; run "pnpm cache:clean" to clear)`
  }`
);

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

export const getCached = (key, opts) => backend.getCached(key, opts);
export const setCached = (key, data, opts) => backend.setCached(key, data, opts);
