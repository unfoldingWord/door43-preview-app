// GET|POST /api/preview/html — render a resource to HTML via the shared
// @unfoldingword/door43-preview-renderers library, server-side. Descriptor in,
// HTML out. This is the seam that replaces the app's in-React rendering: the
// browser stops parsing USFM/TSV and just displays server-rendered HTML.
//
// The S3 cache (check by content hash) and the PDF job queue layer in around
// this route next; for now it renders on every request.
//
// Descriptor (query string for GET, JSON body for POST):
//   owner  (required)  e.g. "unfoldingWord"
//   repo   (required)  e.g. "en_obs"
//   ref                default "master"
//   media              "web" (default) | "print"
//   books              comma-separated list or array; empty = whole resource
//                      (OBS has no book selection, so leave empty)
import {
  getResourceData,
  renderHtmlData,
  renderHTML,
} from '@unfoldingword/door43-preview-renderers';
import { resolveCommitSha } from '../lib/dcs.js';
import { cacheKey, getCached, setCached } from '../lib/preview-cache.js';

const DCS_API_URL = process.env.DCS_API_URL || 'https://git.door43.org/api/v1';

function parseBooks(books) {
  if (Array.isArray(books)) return books;
  if (typeof books === 'string' && books.trim()) {
    return books
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);
  }
  return [];
}

export default async function renderHtml(req, res) {
  const src = req.method === 'POST' ? req.body || {} : req.query || {};
  const owner = src.owner;
  const repo = src.repo;
  const ref = src.ref || 'master';
  const media = src.media === 'print' ? 'print' : 'web';
  const books = parseBooks(src.books);

  if (!owner || !repo) {
    return res.status(400).json({
      error:
        'owner and repo are required, e.g. /api/preview/html?owner=unfoldingWord&repo=en_obs&ref=master',
    });
  }

  try {
    // Resolve the ref to an immutable commit sha so the cache auto-invalidates
    // when content changes (a moving ref like "master" would never invalidate).
    const sha = await resolveCommitSha(owner, repo, ref);
    const key = cacheKey({ owner, repo, sha, media, books });

    const cached = await getCached(key);
    if (cached) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Cache', 'HIT');
      return res.send(cached);
    }

    const resourceData = await getResourceData(
      { owner, repo, ref, books },
      { dcs_api_url: DCS_API_URL, quiet: true }
    );
    const htmlData = renderHtmlData(resourceData, { books });
    const html = renderHTML(htmlData, { media });

    await setCached(key, html);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Cache', 'MISS');
    res.send(html);
  } catch (e) {
    res
      .status(502)
      .json({ error: `render failed for ${owner}/${repo}@${ref}: ${e.message}` });
  }
}
