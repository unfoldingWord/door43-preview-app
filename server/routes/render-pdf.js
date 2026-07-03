// PDF rendering via the shared library + the WeasyPrint sidecar container, with
// a content-addressed cache and an async job queue.
//
// The library's renderPdf() assembles the print HTML and POSTs it to the sidecar
// at WEASYPRINT_SERVICE_URL (a dumb, stateless HTML->PDF container) — we never run
// weasyprint on the host or in this process.
//
// Endpoints:
//   POST /api/preview/pdf            enqueue an async render; -> { jobId, state, ... }
//                                    (or { state: 'completed' } on a cache hit)
//   GET  /api/preview/pdf/:jobId     job status -> { state, queuePosition?, etaSeconds?, error? }
//   GET  /api/preview/pdf?<desc>     render/serve synchronously (a cache HIT once a
//                                    job has completed; also a direct-link path)
//
// Descriptor: owner (req), repo (req), ref (default master), books (comma/array;
// empty = whole resource), pageSize (default A4_PORTRAIT), columns (default 1).
import { renderPdf } from '@unfoldingword/door43-preview-renderers';
import { resolveRenderIdentity } from '../lib/render-identity.js';
import { cacheKey, getCached, setCached, delCached } from '../lib/preview-cache.js';
import { getHtmlData } from '../lib/html-data.js';
import { createJobQueue } from '../lib/job-queue.js';
import { dcsApiUrlFromReq, dcsHostLabel } from '../lib/dcs-host.js';

const WEASYPRINT_SERVICE_URL =
  process.env.WEASYPRINT_SERVICE_URL || 'http://localhost:8080';

// Job priority (lower = sooner): interactive PDF requests jump ahead of warm/cron
// jobs, and re-requesting a warm-queued PDF bumps it to interactive.
const PRIORITY = { INTERACTIVE: 1, WARM: 10 };

function parseBooks(books) {
  if (Array.isArray(books)) return books;
  if (typeof books === 'string' && books.trim()) {
    return books.split(',').map((b) => b.trim()).filter(Boolean);
  }
  return [];
}

function descriptorFrom(req) {
  const s = req.method === 'POST' ? req.body || {} : req.query || {};
  return {
    owner: s.owner,
    repo: s.repo,
    ref: s.ref || '', // empty -> resolveVersion picks the latest release
    books: parseBooks(s.books),
    pageSize: s.pageSize || 'A4_PORTRAIT',
    columns: s.columns ? Number(s.columns) : 1,
    // Resolved here (request context) so it survives serialization into the job —
    // the worker may run out-of-process and can't re-resolve from a request.
    dcsApiUrl: dcsApiUrlFromReq(req),
  };
}

// Resolve the descriptor to the content cache key (used as the job id). The key is
// keyed on the COMPOSITE identity (per-book blob shas + Markdown commit shas), same
// as the web view — so a PDF is only re-rendered when content the book uses changed.
async function keyFor(d) {
  const { composite } = await resolveRenderIdentity({
    owner: d.owner,
    repo: d.repo,
    ref: d.ref,
    books: d.books,
    api: d.dcsApiUrl,
  });
  return cacheKey({
    owner: d.owner,
    repo: d.repo,
    sha: composite,
    media: 'print',
    books: d.books,
    pageSize: d.pageSize,
    columns: d.columns,
  });
}

// Pointer: the last sha we cached a PDF for, per (host, ref, books, pageSize,
// columns). Lets us find and delete the superseded PDF once a fresh one exists.
function pdfPointerKey(d) {
  const host = dcsHostLabel(d.dcsApiUrl);
  const books = (d.books || []).join('+') || '_whole';
  return `pdfsha/${host}/${d.owner}/${d.repo}/${d.ref || '_latest'}/${books}/${d.pageSize}/c${d.columns}`;
}

// Once a fresh PDF is safely cached, remove the previous sha's PDF for this
// ref+params and advance the pointer. Best-effort: the old PDF is only removed
// AFTER the new one is stored, so a stale-but-valid PDF is always available until
// its replacement exists; a failed cleanup never fails the render.
async function reapSupersededPdf(d, newSha, newKey) {
  const ptr = pdfPointerKey(d);
  let prevSha = null;
  try {
    const s = await getCached(ptr, { ext: 'json' });
    if (s) prevSha = JSON.parse(s).sha || null;
  } catch {
    /* unreadable pointer -> treat as none */
  }
  if (prevSha && prevSha !== newSha) {
    const oldKey = cacheKey({
      owner: d.owner,
      repo: d.repo,
      sha: prevSha,
      media: 'print',
      books: d.books,
      pageSize: d.pageSize,
      columns: d.columns,
    });
    if (oldKey !== newKey) {
      await delCached(oldKey, { ext: 'pdf' });
      console.log(
        `[pdf] reaped superseded PDF ${d.owner}/${d.repo}@${d.ref || '_latest'} ` +
          `${String(prevSha).slice(0, 8)} -> ${String(newSha).slice(0, 8)}`
      );
    }
  }
  await setCached(ptr, JSON.stringify({ sha: newSha, at: new Date().toISOString() }), { ext: 'json' });
}

// The actual render: reuse the cached htmlData, then library assembles print HTML
// -> WeasyPrint sidecar -> PDF, then cache the PDF bytes.
async function renderAndCache(d, key) {
  const { htmlData, sha } = await getHtmlData({
    owner: d.owner,
    repo: d.repo,
    ref: d.ref,
    books: d.books,
    dcsApiUrl: d.dcsApiUrl,
  });
  const pdf = await renderPdf(htmlData, {
    pdfServiceUrl: WEASYPRINT_SERVICE_URL,
    pageSize: d.pageSize,
    columns: d.columns,
  });
  await setCached(key, pdf, { ext: 'pdf' });
  // New PDF is now cached -> retire the old sha's PDF (best-effort, never fatal).
  await reapSupersededPdf(d, sha, key).catch((e) =>
    console.error('[pdf] cleanup failed (ignored):', e.message)
  );
  return pdf;
}

// One queue + processor for PDF jobs. The processor reconstructs the render from
// the serializable job data (not a closure), so a BullMQ worker — in this process
// or a separate worker container — can run it.
const pdfQueue = createJobQueue({
  name: 'preview-pdf',
  concurrency: Number(process.env.PREVIEW_JOB_CONCURRENCY) || 2,
  processor: (data) => renderAndCache(data.descriptor, data.key),
});

// Programmatic enqueue-if-missing (used by cache warming). Takes a plain descriptor
// (not a request), fills defaults, and returns whether the PDF is already cached.
export async function ensurePdf(descriptor, { priority = PRIORITY.WARM } = {}) {
  const d = {
    owner: descriptor.owner,
    repo: descriptor.repo,
    ref: descriptor.ref || '',
    books: parseBooks(descriptor.books),
    pageSize: descriptor.pageSize || 'A4_PORTRAIT',
    columns: descriptor.columns ? Number(descriptor.columns) : 1,
    dcsApiUrl: descriptor.dcsApiUrl,
  };
  const key = await keyFor(d);
  const cached = await getCached(key, { ext: 'pdf', binary: true });
  if (cached) return { key, cached: true, state: 'completed' };
  const status = await pdfQueue.enqueue(key, { descriptor: d, key }, { priority });
  return { key, cached: false, ...status };
}

// POST /api/preview/pdf — enqueue (dedup by content key), or report completed on hit.
export async function enqueuePdf(req, res) {
  const d = descriptorFrom(req);
  if (!d.owner || !d.repo) {
    return res.status(400).json({ error: 'owner and repo are required.' });
  }
  try {
    const key = await keyFor(d);
    const cached = await getCached(key, { ext: 'pdf', binary: true });
    if (cached) return res.json({ jobId: key, state: 'completed' });
    // Interactive request -> high priority, jumping ahead of any warm/cron backlog.
    const status = await pdfQueue.enqueue(key, { descriptor: d, key }, { priority: PRIORITY.INTERACTIVE });
    res.status(202).json({ jobId: key, ...status });
  } catch (e) {
    res
      .status(502)
      .json({ error: `PDF enqueue failed for ${d.owner}/${d.repo}@${d.ref}: ${e.message}` });
  }
}

// GET /api/preview/pdf/:jobId — job status (404 once evicted; client then serves from cache).
export async function pdfJobStatus(req, res) {
  const status = await pdfQueue.getJob(req.params.jobId);
  if (!status) return res.status(404).json({ state: 'unknown' });
  res.json(status);
}

// GET /api/preview/pdf?<descriptor> — serve the cached PDF. On a miss it does NOT
// block rendering: it enqueues the render (interactive priority) and returns 503 +
// Retry-After, so the caller (e.g. release tooling collecting warmed URLs) retries
// and gets it once ready. These are normally warmed tags, so a HIT is the common case.
export async function renderPdfSync(req, res) {
  const d = descriptorFrom(req);
  if (!d.owner || !d.repo) {
    return res.status(400).json({ error: 'owner and repo are required.' });
  }
  try {
    const key = await keyFor(d);
    const pdf = await getCached(key, { ext: 'pdf', binary: true });
    if (pdf) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${d.repo}.pdf"`);
      res.setHeader('X-Cache', 'HIT');
      return res.send(pdf);
    }
    // Miss -> enqueue (jump the warm backlog) and tell the caller to retry.
    const status = await pdfQueue.enqueue(key, { descriptor: d, key }, { priority: PRIORITY.INTERACTIVE });
    res.setHeader('Retry-After', '15');
    res.status(503).json({
      state: status.state || 'queued',
      jobId: key,
      message: 'PDF not ready; it is being generated — retry shortly.',
      ...(status.etaSeconds ? { etaSeconds: status.etaSeconds } : {}),
    });
  } catch (e) {
    res
      .status(502)
      .json({ error: `PDF request failed for ${d.owner}/${d.repo}@${d.ref}: ${e.message}` });
  }
}
