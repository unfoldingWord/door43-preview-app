// GET /api/preview/nav?owner&repo&ref&book — chapter/verse structure for a book,
// derived from the ACTUAL rendered content (only what the resource has: a Bible
// gets numeric chapters + a Psalm "front" verse; en_tn/tq/sn/sq get "intro"
// chapters + "front" verses; nothing is listed that isn't there).
//
// It scans the rendered HTML for the renderer's anchor ids
// (`<abbr>-<book>-<chapter>[-<verse>]`) in document order and returns a tree whose
// entries are exact scroll targets.
//
// The tree is small and stable per composite identity, so it is cached directly
// (nav/<host>/<owner>/<repo>/<version>/<book>) and a hit skips getHtmlData entirely
// — no re-parsing the (large) htmlData JSON, no renderHTML, no scan. Staleness uses
// the same composite identity as the web view.
import { renderHTML } from '@unfoldingword/door43-preview-renderers';
import { getHtmlData } from '../lib/html-data.js';
import { resolveRenderIdentity } from '../lib/render-identity.js';
import { getCached, setCached, CACHE_VERSION } from '../lib/preview-cache.js';
import { dcsApiUrlFromReq, dcsHostLabel } from '../lib/dcs-host.js';

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function navKey({ host, owner, repo, version, book }) {
  return `nav/${host}/${owner}/${repo}/${version}/${book}.${CACHE_VERSION}`;
}

// Build the chapter/verse tree by scanning the rendered HTML's anchor ids.
function buildNavTree(htmlData, book) {
  const html = renderHTML(htmlData, { media: 'web' });

  // Element ids only (scroll targets), not href cross-references.
  const re = new RegExp(`\\bid=["']([a-z0-9]+)-${escapeRegex(book)}-([^"']+)["']`, 'gi');
  const order = [];
  const map = new Map(); // chapterId -> { id, anchor, verses: Map(verseId -> anchor) }
  let abbr = null;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!abbr) abbr = m[1].toLowerCase();
    const parts = m[2].split('-');
    const chapterId = parts[0];
    if (!chapterId) continue; // guard against stray/empty anchor tokens
    if (!map.has(chapterId)) {
      order.push(chapterId);
      map.set(chapterId, { id: chapterId, anchor: null, verses: new Map() });
    }
    const chap = map.get(chapterId);
    if (parts.length === 1) {
      // chapter-level anchor
      chap.anchor = chap.anchor || `${m[1]}-${book}-${chapterId}`;
    } else if (parts.length === 2) {
      // verse-level anchor
      const verseId = parts[1];
      if (!verseId) continue;
      if (!chap.verses.has(verseId)) {
        chap.verses.set(verseId, `${m[1]}-${book}-${chapterId}-${verseId}`);
      }
    }
    // parts.length >= 3 -> note-level anchor; skip (verse already captured)
  }

  const chapters = order.map((cid) => {
    const c = map.get(cid);
    const verses = [...c.verses.entries()].map(([id, anchor]) => ({ id, anchor }));
    return { id: cid, anchor: c.anchor || (verses[0] && verses[0].anchor) || null, verses };
  });

  return { book, abbreviation: abbr, chapters };
}

export default async function previewNav(req, res) {
  const owner = req.query.owner;
  const repo = req.query.repo;
  const ref = req.query.ref || ''; // empty -> resolveVersion picks the latest release
  const book = (req.query.book || '').trim().toLowerCase();
  if (!owner || !repo || !book) {
    return res.status(400).json({ error: 'owner, repo and book are required.' });
  }

  const api = dcsApiUrlFromReq(req);
  try {
    // Cheap composite-identity resolve (TTL-cached, shared with the web view).
    const { version, composite } = await resolveRenderIdentity({ owner, repo, ref, books: [book], api });
    const key = navKey({ host: dcsHostLabel(api), owner, repo, version, book });

    const cachedStr = await getCached(key, { ext: 'json' });
    if (cachedStr) {
      try {
        const obj = JSON.parse(cachedStr);
        if (obj && obj.sha === composite && obj.tree) return res.json(obj.tree); // HIT — no htmlData
      } catch {
        /* corrupt entry -> rebuild */
      }
    }

    // MISS/stale: derive from the (shared, coalesced) htmlData. allowStale so a moved
    // branch stays snappy — but only cache the tree when the htmlData is current, so
    // a stale tree is never stored under the current identity.
    const { htmlData, cache } = await getHtmlData({ owner, repo, ref, books: [book], allowStale: true, dcsApiUrl: api });
    const tree = buildNavTree(htmlData, book);
    if (cache !== 'STALE') {
      await setCached(key, JSON.stringify({ sha: composite, tree }), { ext: 'json' });
    }
    res.json(tree);
  } catch (e) {
    res.status(502).json({ error: `nav failed for ${owner}/${repo}@${ref} ${book}: ${e.message}` });
  }
}
