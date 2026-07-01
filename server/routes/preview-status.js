// GET /api/preview/status?owner&repo&ref&book — is the cached web view current?
//
// Cheap freshness probe for the client: resolve the ref to its current commit sha
// and compare it to the sha stored in the cached htmlData. Does NOT fetch or render
// the resource. The client uses this after loading the web view to decide whether to
// show a "source changed — updating…" banner (a branch moved since we cached) and to
// poll until the background revalidation lands, then reload the iframe.
//
//   cache: 'FRESH'  cached sha == current sha (or nothing to compare against yet)
//          'STALE'  cached sha != current sha  -> a revalidation is in flight
//          'MISS'   nothing cached yet         -> the web view render is populating it
import { resolveVersion } from '../lib/versions.js';
import { htmlDataKey } from '../lib/html-data.js';
import { getCached } from '../lib/preview-cache.js';

function parseBooks(book) {
  const b = (book || '').trim().toLowerCase();
  return b ? [b] : [];
}

export default async function previewStatus(req, res) {
  const owner = req.query.owner;
  const repo = req.query.repo;
  const ref = req.query.ref || ''; // empty -> resolveVersion picks the latest release
  const books = parseBooks(req.query.book);
  if (!owner || !repo) {
    return res.status(400).json({ error: 'owner and repo are required.' });
  }

  try {
    const { ref: version, sha } = await resolveVersion(owner, repo, ref);
    const key = htmlDataKey({ owner, repo, version, books });
    const cachedStr = await getCached(key, { ext: 'json' });

    let cache = 'MISS';
    let cachedSha = null;
    if (cachedStr) {
      try {
        const obj = JSON.parse(cachedStr);
        if (obj && obj.htmlData) {
          cachedSha = obj.sha || null;
          cache = cachedSha === sha ? 'FRESH' : 'STALE';
        }
      } catch {
        /* corrupt entry -> treat as MISS (render will replace it) */
      }
    }

    res.json({ owner, repo, version, sha, cachedSha, cache });
  } catch (e) {
    res.status(502).json({ error: `status failed for ${owner}/${repo}@${ref}: ${e.message}` });
  }
}
