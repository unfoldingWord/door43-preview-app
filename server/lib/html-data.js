// Cached access to a resource's htmlData (the renderHtmlData() output).
//
// We cache the htmlData JSON — NOT the final HTML — so callers can apply
// renderHTML(options) (media, columns, hide cover/toc, …) or renderPdf() per
// request without re-fetching or re-parsing the source.
//
// Cache layout is readable and version-keyed (aligns with the hot-link URLs):
//   htmldata/<owner>/<repo>/<version>/<book|_whole>.<CACHE_VERSION>.json
// The object stores { sha, renderedAt, htmlData }. The commit sha inside drives
// staleness: a HIT requires the cached sha to match the ref's current sha. On a
// mismatch (branch moved / tag re-cut) getHtmlData either serves the stale copy
// while revalidating in the background (allowStale, for the web view + nav) or
// re-renders the current sha before returning (the PDF path).
import { getResourceData, renderHtmlData } from '@unfoldingword/door43-preview-renderers';
import { resolveRenderIdentity } from './render-identity.js';
import { getCached, setCached, CACHE_VERSION } from './preview-cache.js';
import { resolveDcsHost, dcsApiUrl, dcsHostLabel } from './dcs-host.js';
import { log } from './log.js';

// Default DCS host when no per-request host is threaded in (env / QA default).
const DEFAULT_API = dcsApiUrl(resolveDcsHost({}));

function bookSegment(books) {
  if (!books || books.length === 0) return '_whole';
  if (books.length === 1) return books[0];
  return books.join('+');
}

// Cache is namespaced by DCS host (dcsApiUrl) so a request for one host never
// serves content cached from another (e.g. ?server=QA vs the default).
export function htmlDataKey({ owner, repo, version, books, dcsApiUrl: api = DEFAULT_API }) {
  return `htmldata/${dcsHostLabel(api)}/${owner}/${repo}/${version}/${bookSegment(books)}.${CACHE_VERSION}`;
}

// In-flight renders keyed by cache key, so concurrent misses for the same resource
// (e.g. the web view and the nav lookup) fetch/parse the source once, not twice.
const inflightRenders = new Map();

// Fetch + parse + render the current sha for `key`, cache it, and return the
// htmlData. Concurrent callers for the same key share one run (dedup), so a cold
// miss fetches the source once even when the web view, nav, and PDF all ask at once.
function renderFor({ owner, repo, version, sha, manifest, books, key, api }) {
  if (inflightRenders.has(key)) return inflightRenders.get(key);
  const p = (async () => {
    const resourceData = await getResourceData(
      { owner, repo, ref: version, books },
      { dcs_api_url: api, quiet: true }
    );
    const htmlData = renderHtmlData(resourceData, { books });
    // Store the manifest alongside the render so a later request can show what this
    // cached HTML was "built with" and diff it against the current identity.
    await setCached(
      key,
      JSON.stringify({ sha, renderedAt: new Date().toISOString(), manifest, htmlData }),
      { ext: 'json' }
    );
    return htmlData;
  })();
  inflightRenders.set(key, p);
  // Best-effort cleanup; guard the delete so a newer run for the same key survives.
  p.catch(() => {}).finally(() => {
    if (inflightRenders.get(key) === p) inflightRenders.delete(key);
  });
  return p;
}

// allowStale (web view + nav): on a moved branch, return the previous render at once
// and refresh in the background. Off (PDF): always render the current sha so the
// artifact is never built from stale data.
export async function getHtmlData({
  owner,
  repo,
  ref = '',
  books = [],
  allowStale = false,
  dcsApiUrl: api = DEFAULT_API,
}) {
  const t0 = Date.now();
  const label = `${owner}/${repo} ${books.join(',') || '_whole'} [${dcsHostLabel(api)}]`;
  // `sha` here is the COMPOSITE identity across every resource the render uses
  // (per-book blob shas for book-organized repos, commit shas for Markdown), so a
  // book only goes stale when content it actually uses changed. Empty ref -> latest.
  const { version, composite: sha, manifest } = await resolveRenderIdentity({ owner, repo, ref, books, api });
  const tResolve = Date.now();
  const key = htmlDataKey({ owner, repo, version, books, dcsApiUrl: api });

  const cachedStr = await getCached(key, { ext: 'json' });
  const tCache = Date.now();
  let staleHtmlData = null;
  let staleManifest = null;
  if (cachedStr) {
    try {
      const obj = JSON.parse(cachedStr);
      if (obj && obj.htmlData) {
        if (obj.sha === sha) {
          log.debug(
            `[html-data] ${label}@${version}: HIT  resolve=${tResolve - t0}ms cacheGet=${tCache - tResolve}ms`
          );
          return { htmlData: obj.htmlData, sha, version, key, cache: 'HIT', manifest: obj.manifest || manifest };
        }
        staleHtmlData = obj.htmlData; // sha mismatch -> branch moved since we cached
        staleManifest = obj.manifest || null; // what the stale render was built with
      }
    } catch {
      /* corrupt entry -> re-render */
    }
  }

  const alreadyRendering = inflightRenders.has(key);
  const render = renderFor({ owner, repo, version, sha, manifest, books, key, api });

  // Serve-stale-while-revalidate: hand back the previous render now; `render` above
  // refreshes the cache to `sha` in the background so the next request is a HIT.
  if (staleHtmlData && allowStale) {
    const sha8 = String(sha).slice(0, 8);
    log.debug(`[html-data] ${label}@${version}: STALE (serving cached, revalidating -> ${sha8})`);
    // Log the background result once (only the caller that started the render).
    if (!alreadyRendering) {
      render
        .then(() => log.debug(`[html-data] ${label}@${version}: revalidated -> ${sha8} (now FRESH)`))
        .catch((e) => log.warn(`[html-data] ${label}@${version}: revalidation FAILED (${sha8}): ${e.message}`));
    }
    return { htmlData: staleHtmlData, sha, version, key, cache: 'STALE', manifest: staleManifest || manifest };
  }

  const htmlData = await render;
  const status = staleHtmlData ? 'REPLACED' : alreadyRendering ? 'COALESCED' : 'MISS';
  log.debug(
    `[html-data] ${label}@${version}: ${status}  ` +
      `resolve=${tResolve - t0}ms cacheGet=${tCache - tResolve}ms fetch+render=${Date.now() - tCache}ms`
  );
  return { htmlData, sha, version, key, cache: status, manifest };
}
