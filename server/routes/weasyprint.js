// POST /api/weasyprint — proxy a complete print HTML document to the internal
// weasyprint-service and stream back the PDF.
//
// The WeasyPrint engine (Python) runs in its own container; this Express route is
// the public, CORS-enabled surface (e.g. preview.door43.org/api/weasyprint) used
// both by this app and by the door43-preview-renderers styleguide (as its
// `pdfServiceUrl`). Contract: POST text/html -> application/pdf.

const SERVICE_URL = process.env.WEASYPRINT_SERVICE_URL || 'http://localhost:8080';

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
    res
      .status(502)
      .json({ error: `weasyprint service unreachable at ${SERVICE_URL}: ${e.message}` });
  }
}
