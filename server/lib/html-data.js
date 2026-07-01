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
import { resolveVersion } from './versions.js';
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

// In-flight renders keyed by cache key, so concurrent misses for the same resource
// (e.g. the web view and the nav lookup) fetch/parse the source once, not twice.
const inflightRenders = new Map();

export async function getHtmlData({ owner, repo, ref = '', books = [] }) {
  const t0 = Date.now();
  const label = `${owner}/${repo} ${books.join(',') || '_whole'}`;
  // Resolve the requested version to a concrete ref + sha (empty -> latest release).
  const { ref: version, sha } = await resolveVersion(owner, repo, ref);
  const tResolve = Date.now();
  const key = htmlDataKey({ owner, repo, version, books });

  const cachedStr = await getCached(key, { ext: 'json' });
  const tCache = Date.now();
  if (cachedStr) {
    try {
      const obj = JSON.parse(cachedStr);
      if (obj && obj.sha === sha && obj.htmlData) {
        console.log(
          `[html-data] ${label}@${version}: HIT  resolve=${tResolve - t0}ms cacheGet=${tCache - tResolve}ms`
        );
        return { htmlData: obj.htmlData, sha, version, key, cache: 'HIT' };
      }
      // sha mismatch -> content changed; fall through and re-render (P4: serve stale).
    } catch {
      /* corrupt entry -> re-render */
    }
  }

  // MISS: coalesce concurrent renders of the same key so the source is fetched and
  // parsed once even when the web view + nav (or several tabs) ask at the same time.
  if (inflightRenders.has(key)) {
    const htmlData = await inflightRenders.get(key);
    console.log(`[html-data] ${label}@${version}: COALESCED (joined in-flight render)`);
    return { htmlData, sha, version, key, cache: 'COALESCED' };
  }

  const renderPromise = (async () => {
    const resourceData = await getResourceData(
      { owner, repo, ref: version, books },
      { dcs_api_url: DCS_API_URL, quiet: true }
    );
    const htmlData = renderHtmlData(resourceData, { books });
    await setCached(
      key,
      JSON.stringify({ sha, renderedAt: new Date().toISOString(), htmlData }),
      { ext: 'json' }
    );
    return htmlData;
  })();
  inflightRenders.set(key, renderPromise);

  try {
    const htmlData = await renderPromise;
    console.log(
      `[html-data] ${label}@${version}: ${cachedStr ? 'REPLACED' : 'MISS'}  ` +
        `resolve=${tResolve - t0}ms cacheGet=${tCache - tResolve}ms fetch+render=${Date.now() - tCache}ms`
    );
    return { htmlData, sha, version, key, cache: cachedStr ? 'REPLACED' : 'MISS' };
  } finally {
    inflightRenders.delete(key);
  }
}
