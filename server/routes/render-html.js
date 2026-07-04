// /api/preview/html      (GET|POST) — render a resource to final HTML.
// /api/preview/html-json (GET|POST) — the cached htmlData JSON it's built from.
//
// Two-stage: getHtmlData() returns the cached renderHtmlData() JSON (data fetch +
// parse, the expensive part, cached under a readable version path). The HTML itself
// is NOT cached — renderHTML() composes it per request from that htmlData with the
// requested options (media, columns, …), which is cheap. html-json hands back the
// same htmlData so a caller can render it themselves (renderHTML) or inspect it.
//
// Descriptor (query for GET, JSON body for POST):
//   owner (req), repo (req), ref (default = latest release), books (comma list /
//   array; empty = whole resource). /html also takes media ("web"|"print") + columns.
import { renderHTML } from '@unfoldingword/door43-preview-renderers';
import { getHtmlData } from '../lib/html-data.js';
import { dcsApiUrlFromReq } from '../lib/dcs-host.js';

function parseBooks(books) {
  if (Array.isArray(books)) return books;
  if (typeof books === 'string' && books.trim()) {
    return books.split(',').map((b) => b.trim()).filter(Boolean);
  }
  return [];
}

// Shared descriptor from the request (GET query or POST body).
function descriptorFrom(req) {
  const src = req.method === 'POST' ? req.body || {} : req.query || {};
  return { owner: src.owner, repo: src.repo, ref: src.ref || '', books: parseBooks(src.books), src };
}

// Build renderHTML() options from the request (applied to cached htmlData).
function composeOptions(src) {
  const opts = { media: src.media === 'print' ? 'print' : 'web' };
  if (src.columns) opts.columns = Number(src.columns);
  return opts;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// A readable error page for the <iframe> (a resource/ref may not be renderable).
// Served 200 so the iframe reliably displays it instead of a raw error body.
function errorPage(res, message) {
  res.status(200).set('Content-Type', 'text/html; charset=utf-8').send(
    `<!doctype html><meta charset="utf-8">` +
      `<body style="font-family:system-ui,-apple-system,sans-serif;color:#231F20;padding:2.5rem;line-height:1.6">` +
      `<h2 style="color:#014263;margin:0 0 .5rem">Unable to preview</h2>` +
      `<p>${escapeHtml(message)}</p>` +
      `<p style="color:#888">Check the owner, repository and version/branch — or pick a different one.</p>` +
      `</body>`
  );
}

// GET|POST /api/preview/html — final HTML, built per request from cached htmlData.
export default async function renderHtml(req, res) {
  const { owner, repo, ref, books, src } = descriptorFrom(req);
  if (!owner || !repo) {
    return res.status(400).json({
      error:
        'owner and repo are required, e.g. /api/preview/html?owner=unfoldingWord&repo=en_obs&ref=master',
    });
  }

  try {
    // allowStale: on a moved branch, serve the last render immediately and let the
    // cache refresh in the background — the client's status poll handles the swap.
    const { htmlData, cache } = await getHtmlData({
      owner,
      repo,
      ref,
      books,
      allowStale: true,
      dcsApiUrl: dcsApiUrlFromReq(req),
    });
    const html = renderHTML(htmlData, composeOptions(src));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Cache', cache); // HIT | STALE | COALESCED | MISS | REPLACED
    res.send(html);
  } catch (e) {
    errorPage(res, `Couldn't render ${owner}/${repo}${ref ? `@${ref}` : ''}: ${e.message}`);
  }
}

// GET|POST /api/preview/html-json — the cached htmlData JSON (renderHtmlData output).
// Media/columns are render-time options, so they don't apply here — the caller passes
// them to renderHTML(htmlData, opts) themselves. Metadata is returned in headers.
export async function renderHtmlJson(req, res) {
  const { owner, repo, ref, books } = descriptorFrom(req);
  if (!owner || !repo) {
    return res.status(400).json({ error: 'owner and repo are required.' });
  }

  try {
    const { htmlData, sha, version, cache } = await getHtmlData({
      owner,
      repo,
      ref,
      books,
      allowStale: true,
      dcsApiUrl: dcsApiUrlFromReq(req),
    });
    res.setHeader('X-Cache', cache);
    res.setHeader('X-Version', version);
    res.setHeader('X-Sha', sha);
    res.json(htmlData);
  } catch (e) {
    res
      .status(502)
      .json({ error: `Couldn't build htmlData for ${owner}/${repo}${ref ? `@${ref}` : ''}: ${e.message}` });
  }
}
