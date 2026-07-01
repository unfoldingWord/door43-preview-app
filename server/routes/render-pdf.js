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
import { resolveVersion } from '../lib/versions.js';
import { cacheKey, getCached, setCached } from '../lib/preview-cache.js';
import { getHtmlData } from '../lib/html-data.js';
import { createJobQueue } from '../lib/job-queue.js';

const WEASYPRINT_SERVICE_URL =
  process.env.WEASYPRINT_SERVICE_URL || 'http://localhost:8080';

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
  };
}

// Resolve the descriptor to the immutable content cache key (used as the job id).
// resolveVersion defaults an empty ref to the latest release (same as getHtmlData).
async function keyFor(d) {
  const { sha } = await resolveVersion(d.owner, d.repo, d.ref);
  return cacheKey({
    owner: d.owner,
    repo: d.repo,
    sha,
    media: 'print',
    books: d.books,
    pageSize: d.pageSize,
    columns: d.columns,
  });
}

// The actual render: reuse the cached htmlData, then library assembles print HTML
// -> WeasyPrint sidecar -> PDF, then cache the PDF bytes.
async function renderAndCache(d, key) {
  const { htmlData } = await getHtmlData({
    owner: d.owner,
    repo: d.repo,
    ref: d.ref,
    books: d.books,
  });
  const pdf = await renderPdf(htmlData, {
    pdfServiceUrl: WEASYPRINT_SERVICE_URL,
    pageSize: d.pageSize,
    columns: d.columns,
  });
  await setCached(key, pdf, { ext: 'pdf' });
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
    const status = await pdfQueue.enqueue(key, { descriptor: d, key });
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

// GET /api/preview/pdf?<descriptor> — synchronous render/serve (cache HIT after a job).
export async function renderPdfSync(req, res) {
  const d = descriptorFrom(req);
  if (!d.owner || !d.repo) {
    return res.status(400).json({ error: 'owner and repo are required.' });
  }
  try {
    const key = await keyFor(d);
    let pdf = await getCached(key, { ext: 'pdf', binary: true });
    let cache = 'HIT';
    if (!pdf) {
      pdf = await renderAndCache(d, key);
      cache = 'MISS';
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${d.repo}.pdf"`);
    res.setHeader('X-Cache', cache);
    res.send(pdf);
  } catch (e) {
    res
      .status(502)
      .json({ error: `PDF render failed for ${d.owner}/${d.repo}@${d.ref}: ${e.message}` });
  }
}
