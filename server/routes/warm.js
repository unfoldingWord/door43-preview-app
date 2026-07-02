// GET /api/warm?owner&repo&ref&token — warm a resource's PDFs into the cache.
//
// Renders every book (each page size) plus a whole-resource PDF (except TSV
// Translation Notes) via the async job queue, then returns a manifest with a stable
// serve URL per PDF. Idempotent: only missing PDFs are enqueued, so poll the same
// URL to watch progress and, when state === 'done', collect the PDF list.
//
// Token-gated: requires WARM_TOKEN (env, shared with whoever triggers). Pass it as
// ?token= or the X-Warm-Token header. (The request logger logs only the path, not
// the query, so the token isn't written to app logs.)
import { warmResource } from '../lib/warm.js';
import { dcsApiUrlFromReq } from '../lib/dcs-host.js';

export default async function warm(req, res) {
  const token = process.env.WARM_TOKEN;
  if (!token) {
    return res.status(503).json({ error: 'warming is not configured (set WARM_TOKEN).' });
  }
  const provided = req.get('x-warm-token') || req.query.token || '';
  if (provided !== token) {
    return res.status(401).json({ error: 'invalid or missing warm token.' });
  }

  const owner = req.query.owner;
  const repo = req.query.repo;
  const ref = req.query.ref || ''; // empty -> latest release
  if (!owner || !repo) {
    return res.status(400).json({ error: 'owner and repo are required.' });
  }

  try {
    const result = await warmResource({ owner, repo, ref, api: dcsApiUrlFromReq(req) });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: `warm failed for ${owner}/${repo}@${ref}: ${e.message}` });
  }
}
