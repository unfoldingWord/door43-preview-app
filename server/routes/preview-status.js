// GET /api/preview/status?owner&repo&ref&book — is the cached web view current, and
// what did it change from?
//
// Resolves the current composite identity + manifest and compares to the cached
// render's stored manifest. Does NOT fetch or render. The client uses this to show
// the "source changed — updating…" banner (naming the changed resources/books) and
// to poll until the background revalidation lands, then reload the iframe. It also
// returns `builtWith` — the manifest of the currently-shown render — for the
// "Built with" panel.
//
//   cache: 'FRESH'  cached sha == current sha (or nothing to compare against yet)
//          'STALE'  cached sha != current sha  -> a revalidation is in flight
//          'MISS'   nothing cached yet         -> the web view render is populating it
//   builtWith: [ per-resource manifest of the shown render ]  (null on MISS with no cache)
//   changed:   [ resources (and books) whose content differs ]  (empty unless STALE)
import { resolveRenderIdentity } from '../lib/render-identity.js';
import { htmlDataKey } from '../lib/html-data.js';
import { getCached } from '../lib/preview-cache.js';
import { dcsApiUrlFromReq } from '../lib/dcs-host.js';

function parseBooks(book) {
  const b = (book || '').trim().toLowerCase();
  return b ? [b] : [];
}

// A compact resource summary for the banner, plus which books changed (per-book
// granularity) when both sides carry book blobs.
function changeSummary(next, prev) {
  let books = null;
  if (next.books && prev && prev.books) {
    books = Object.keys(next.books).filter((b) => prev.books[b] !== next.books[b]);
  }
  return {
    repo: next.repo,
    owner: next.owner,
    subject: next.subject,
    title: next.title,
    abbreviation: next.abbreviation,
    ref: next.ref,
    commit: next.commit,
    ...(books && books.length ? { books } : {}),
  };
}

// Which resources (and books) differ between the shown render and the current one.
function diffManifests(prevM, nextM) {
  if (!Array.isArray(prevM) || !Array.isArray(nextM)) return []; // pre-upgrade entry -> generic
  const byKey = new Map(prevM.map((e) => [e.key, e]));
  const changed = [];
  for (const n of nextM) {
    const p = byKey.get(n.key);
    if (!p) changed.push({ ...changeSummary(n, null), added: true }); // new dependency
    else if (p.contribution !== n.contribution) changed.push(changeSummary(n, p));
  }
  const nextKeys = new Set(nextM.map((e) => e.key));
  for (const p of prevM) if (!nextKeys.has(p.key)) changed.push({ ...changeSummary(p, null), removed: true });
  return changed;
}

export default async function previewStatus(req, res) {
  const owner = req.query.owner;
  const repo = req.query.repo;
  const ref = req.query.ref || ''; // empty -> resolveVersion picks the latest release
  const books = parseBooks(req.query.book);
  if (!owner || !repo) {
    return res.status(400).json({ error: 'owner and repo are required.' });
  }

  const api = dcsApiUrlFromReq(req);
  try {
    const { version, composite: sha, manifest: current } = await resolveRenderIdentity({ owner, repo, ref, books, api });
    const key = htmlDataKey({ owner, repo, version, books, dcsApiUrl: api });
    const cachedStr = await getCached(key, { ext: 'json' });

    let cache = 'MISS';
    let cachedSha = null;
    let cachedManifest = null;
    if (cachedStr) {
      try {
        const obj = JSON.parse(cachedStr);
        if (obj && obj.htmlData) {
          cachedSha = obj.sha || null;
          cachedManifest = obj.manifest || null;
          cache = cachedSha === sha ? 'FRESH' : 'STALE';
        }
      } catch {
        /* corrupt entry -> treat as MISS (render will replace it) */
      }
    }

    // What's shown was built with the cached manifest; fall back to current (fresh
    // render / pre-upgrade entry that predates stored manifests).
    const builtWith = cachedManifest || current;
    const changed = cache === 'STALE' ? diffManifests(cachedManifest, current) : [];

    res.json({ owner, repo, version, sha, cachedSha, cache, builtWith, changed });
  } catch (e) {
    res.status(502).json({ error: `status failed for ${owner}/${repo}@${ref}: ${e.message}` });
  }
}
