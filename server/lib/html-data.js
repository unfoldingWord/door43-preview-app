// Cached access to a resource's htmlData (the renderHtmlData() output).
//
// We cache the htmlData JSON — NOT the final HTML — so callers can apply
// renderHTML(options) (media, columns, hide cover/toc, …) or renderPdf() per
// request without re-fetching or re-parsing the source.
//
// Cache layout is readable and version-keyed (aligns with the hot-link URLs):
//   htmldata/<owner>/<repo>/<version>/<book|_whole>.<CACHE_VERSION>.json
// The object stores { sha, renderedAt, htmlData }. The commit sha inside drives
// staleness: a HIT requires the cached sha to match the ref's current sha; a
// mismatch (branch moved / tag re-cut) re-renders. (Phase 4 will serve the stale
// copy while revalidating instead of blocking.)
import { getResourceData, renderHtmlData } from '@unfoldingword/door43-preview-renderers';
import { resolveCommitSha } from './dcs.js';
import { getCached, setCached, CACHE_VERSION } from './preview-cache.js';

const DCS_API_URL = process.env.DCS_API_URL || 'https://git.door43.org/api/v1';

function bookSegment(books) {
  if (!books || books.length === 0) return '_whole';
  if (books.length === 1) return books[0];
  return books.join('+');
}

export function htmlDataKey({ owner, repo, version, books }) {
  return `htmldata/${owner}/${repo}/${version}/${bookSegment(books)}.${CACHE_VERSION}`;
}

export async function getHtmlData({ owner, repo, ref = 'master', books = [] }) {
  const sha = await resolveCommitSha(owner, repo, ref);
  const key = htmlDataKey({ owner, repo, version: ref, books });

  const cachedStr = await getCached(key, { ext: 'json' });
  if (cachedStr) {
    try {
      const obj = JSON.parse(cachedStr);
      if (obj && obj.sha === sha && obj.htmlData) {
        return { htmlData: obj.htmlData, sha, key, cache: 'HIT' };
      }
      // sha mismatch -> content changed; fall through and re-render (P4: serve stale).
    } catch {
      /* corrupt entry -> re-render */
    }
  }

  const resourceData = await getResourceData(
    { owner, repo, ref, books },
    { dcs_api_url: DCS_API_URL, quiet: true }
  );
  const htmlData = renderHtmlData(resourceData, { books });
  await setCached(
    key,
    JSON.stringify({ sha, renderedAt: new Date().toISOString(), htmlData }),
    { ext: 'json' }
  );
  return { htmlData, sha, key, cache: cachedStr ? 'REPLACED' : 'MISS' };
}
