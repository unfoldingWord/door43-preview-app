// POST /api/weasyprint — proxy a complete print HTML document to the internal
// weasyprint-service and stream back the PDF.
//
// The WeasyPrint engine (Python) runs in its own container; this Express route is
// the public, CORS-enabled surface (e.g. preview.door43.org/api/weasyprint) used
// both by this app and by the door43-preview-renderers styleguide (as its
// `pdfServiceUrl`). Contract: POST text/html -> application/pdf.

const SERVICE_URL = process.env.WEASYPRINT_SERVICE_URL || 'http://localhost:8080';

// A full-book render (e.g. Romans TN) is synchronous and can take minutes.
// Bound the upstream request explicitly: Node's global fetch (undici) defaults to
// a ~300s headers timeout, which a 5-minute render sits right on the edge of. Give
// a generous, configurable ceiling so long renders complete, while a genuinely
// hung renderer still fails cleanly instead of hanging forever.
const TIMEOUT_MS = Number(process.env.WEASYPRINT_TIMEOUT_MS) || 360000;

export default async function weasyprint(req, res) {
  const html = typeof req.body === 'string' ? req.body : '';
  if (!html.trim()) {
    return res
      .status(400)
      .json({ error: 'POST a complete HTML document (Content-Type: text/html).' });
  }

  try {
    const upstream = await fetch(SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/html' },
      body: html,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => upstream.statusText);
      return res
        .status(502)
        .json({ error: `weasyprint service error (${upstream.status}): ${String(detail).slice(0, 500)}` });
    }

    const pdf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
    res.setHeader('Content-Length', pdf.length);
    res.end(pdf);
  } catch (e) {
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    res
      .status(timedOut ? 504 : 502)
      .json({
        error: timedOut
          ? `weasyprint service timed out after ${TIMEOUT_MS}ms rendering the PDF.`
          : `weasyprint service unreachable at ${SERVICE_URL}: ${e.message}`,
      });
  }
}
