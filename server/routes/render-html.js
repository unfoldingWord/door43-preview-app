// GET|POST /api/preview/html — render a resource to HTML.
//
// Two-stage: getHtmlData() returns the cached renderHtmlData() JSON (data fetch +
// parse, the expensive part, cached under a readable version path); renderHTML()
// composes the final HTML per request with the requested options — so media,
// columns, hide cover/toc, etc. change without re-fetching or re-parsing.
//
// Descriptor (query for GET, JSON body for POST):
//   owner (req), repo (req), ref (default master), media ("web"|"print"),
//   books (comma list / array; empty = whole resource), columns (optional).
import { renderHTML } from '@unfoldingword/door43-preview-renderers';
import { getHtmlData } from '../lib/html-data.js';

function parseBooks(books) {
  if (Array.isArray(books)) return books;
  if (typeof books === 'string' && books.trim()) {
    return books.split(',').map((b) => b.trim()).filter(Boolean);
  }
  return [];
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

export default async function renderHtml(req, res) {
  const src = req.method === 'POST' ? req.body || {} : req.query || {};
  const owner = src.owner;
  const repo = src.repo;
  const ref = src.ref || ''; // empty -> resolveVersion picks the latest release
  const books = parseBooks(src.books);

  if (!owner || !repo) {
    return res.status(400).json({
      error:
        'owner and repo are required, e.g. /api/preview/html?owner=unfoldingWord&repo=en_obs&ref=master',
    });
  }

  try {
    const { htmlData, cache } = await getHtmlData({ owner, repo, ref, books });
    const html = renderHTML(htmlData, composeOptions(src));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Cache', cache); // HIT | MISS | REPLACED (htmlData cache)
    res.send(html);
  } catch (e) {
    errorPage(res, `Couldn't render ${owner}/${repo}${ref ? `@${ref}` : ''}: ${e.message}`);
  }
}
