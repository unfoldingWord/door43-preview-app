// GET|POST /api/preview/pdf — render a resource to a PDF via the shared library
// and the WeasyPrint sidecar container. Descriptor in, application/pdf out.
//
// The library's renderPdf() assembles the print HTML and POSTs it to the sidecar
// at WEASYPRINT_SERVICE_URL (a dumb, stateless HTML->PDF container); we never run
// weasyprint on the host or in this process. The rendered PDF is cached the same
// content-addressed way as HTML (disk now, S3 later).
//
// Synchronous for now (fine for small resources like OBS). Large resources will
// route through the async job queue — that layer wraps this same render call.
//
// Descriptor (query for GET, JSON body for POST):
//   owner (required), repo (required), ref (default master),
//   books (comma list / array; empty = whole resource),
//   pageSize (default "A4_PORTRAIT"), columns (default 1)
import {
  getResourceData,
  renderHtmlData,
  renderPdf,
} from '@unfoldingword/door43-preview-renderers';
import { resolveCommitSha } from '../lib/dcs.js';
import { cacheKey, getCached, setCached } from '../lib/preview-cache.js';

const DCS_API_URL = process.env.DCS_API_URL || 'https://git.door43.org/api/v1';
const WEASYPRINT_SERVICE_URL =
  process.env.WEASYPRINT_SERVICE_URL || 'http://localhost:8080';

function parseBooks(books) {
  if (Array.isArray(books)) return books;
  if (typeof books === 'string' && books.trim()) {
    return books.split(',').map((b) => b.trim()).filter(Boolean);
  }
  return [];
}

export default async function renderPdfRoute(req, res) {
  const src = req.method === 'POST' ? req.body || {} : req.query || {};
  const owner = src.owner;
  const repo = src.repo;
  const ref = src.ref || 'master';
  const books = parseBooks(src.books);
  const pageSize = src.pageSize || 'A4_PORTRAIT';
  const columns = src.columns ? Number(src.columns) : 1;

  if (!owner || !repo) {
    return res.status(400).json({
      error:
        'owner and repo are required, e.g. /api/preview/pdf?owner=unfoldingWord&repo=en_obs&ref=master',
    });
  }

  try {
    const sha = await resolveCommitSha(owner, repo, ref);
    const key = cacheKey({ owner, repo, sha, media: 'print', books, pageSize, columns });

    const sendPdf = (buf, cache) => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${repo}.pdf"`);
      res.setHeader('X-Cache', cache);
      res.send(buf);
    };

    const cached = await getCached(key, { ext: 'pdf', binary: true });
    if (cached) return sendPdf(cached, 'HIT');

    const resourceData = await getResourceData(
      { owner, repo, ref, books },
      { dcs_api_url: DCS_API_URL, quiet: true }
    );
    const htmlData = renderHtmlData(resourceData, { books });

    // renderPdf assembles the print HTML and POSTs it to the WeasyPrint sidecar,
    // returning the PDF bytes. No local weasyprint binary is used.
    const pdf = await renderPdf(htmlData, {
      pdfServiceUrl: WEASYPRINT_SERVICE_URL,
      pageSize,
      columns,
    });

    await setCached(key, pdf, { ext: 'pdf' });
    sendPdf(pdf, 'MISS');
  } catch (e) {
    res
      .status(502)
      .json({ error: `PDF render failed for ${owner}/${repo}@${ref}: ${e.message}` });
  }
}
