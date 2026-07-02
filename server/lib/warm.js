// Cache warming — render every book of a resource/ref into the PDF cache at each
// configured page size (A4 + US Letter), plus a single whole-resource PDF (with the
// TOC + page numbers the print assembler generates) EXCEPT for TSV Translation Notes,
// which are too large to compile whole. Rendering a PDF also warms its htmlData, so
// the web view is warmed as a side effect.
//
// Idempotent: an item is enqueued only if its PDF isn't already cached, so a repeat
// call is a status check plus a top-up of anything still missing. Returns the full
// manifest with per-item cached state + a stable serve URL for each PDF.
import { resolveVersion } from './versions.js';
import { ensurePdf } from '../routes/render-pdf.js';

export const WARM_PAGE_SIZES = (process.env.WARM_PAGE_SIZES || 'A4_PORTRAIT,US_LETTER_PORTRAIT')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const NON_BOOK = new Set(['frt', 'bak', 'int']); // front/back/intro ingredients aren't books
const NO_WHOLE_SUBJECTS = new Set(['TSV Translation Notes']); // too huge to compile whole
const ENUM_CONCURRENCY = Number(process.env.WARM_ENUM_CONCURRENCY) || 8;

const enc = (s) => encodeURIComponent(s);

// Run fn over items with bounded concurrency, preserving order.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

// Resource subject + book ids, from its catalog entry ingredients.
async function resourceInfo(owner, repo, version, api) {
  const url = `${api}/catalog/entry/${enc(owner)}/${enc(repo)}/${enc(version)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`catalog entry ${r.status} for ${owner}/${repo}@${version}`);
  const e = await r.json();
  const books = (e.ingredients || [])
    .map((i) => i.identifier)
    .filter((id) => id && !NON_BOOK.has(id));
  return { subject: e.subject, books };
}

// Stable serve URL for a warmed PDF (serves the cached PDF; re-renders if evicted).
function pdfUrl({ owner, repo, version, books, pageSize }) {
  const q = new URLSearchParams({ owner, repo, ref: version, pageSize });
  if (books.length) q.set('books', books.join(','));
  return `/api/preview/pdf?${q.toString()}`;
}

// The render matrix: each book x each page size, plus the whole resource x each page
// size (unless it's a TN or a single-book resource, where "whole" == the one book).
function buildItems({ subject, books, pageSizes }) {
  const items = [];
  for (const book of books) {
    for (const pageSize of pageSizes) items.push({ books: [book], pageSize, label: book });
  }
  if (!NO_WHOLE_SUBJECTS.has(subject) && books.length > 1) {
    for (const pageSize of pageSizes) items.push({ books: [], pageSize, label: '(whole)', whole: true });
  }
  return items;
}

/**
 * Warm a resource/ref: resolve the version, enumerate books, and enqueue each missing
 * PDF (per book x page size, plus whole). Idempotent.
 * @returns manifest { owner, repo, version, subject, total, cached, pending, failed,
 *                     state, items: [{ label, books, pageSize, whole, cached, url, error? }] }
 */
export async function warmResource({ owner, repo, ref = '', api, pageSizes = WARM_PAGE_SIZES }) {
  const { ref: version } = await resolveVersion(owner, repo, ref, api);
  const { subject, books } = await resourceInfo(owner, repo, version, api);
  const items = buildItems({ subject, books, pageSizes });

  const results = await mapLimit(items, ENUM_CONCURRENCY, async (it) => {
    const base = {
      label: it.label,
      books: it.books,
      pageSize: it.pageSize,
      whole: !!it.whole,
      url: pdfUrl({ owner, repo, version, books: it.books, pageSize: it.pageSize }),
    };
    try {
      const r = await ensurePdf({ owner, repo, ref: version, books: it.books, pageSize: it.pageSize, dcsApiUrl: api });
      return { ...base, cached: r.cached };
    } catch (e) {
      return { ...base, cached: false, error: e.message };
    }
  });

  const cached = results.filter((r) => r.cached).length;
  const failed = results.filter((r) => r.error).length;
  return {
    owner,
    repo,
    version,
    subject,
    total: results.length,
    cached,
    failed,
    pending: results.length - cached - failed,
    state: cached + failed === results.length ? 'done' : 'warming',
    items: results,
  };
}
