// Express server to replace Netlify Functions
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import saveHtmltoCacheHandler from './routes/save-html-to-cache.js';
import getCachedHtmlHandler from './routes/get-cached-html.js';
import serveCachedPage from './routes/serve-cached-page.js';
import configRoute from './routes/config.js';
import weasyprintHandler from './routes/weasyprint.js';
import renderHtmlHandler from './routes/render-html.js';
import { renderPdfSync, enqueuePdf, pdfJobStatus } from './routes/render-pdf.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint (before other routes)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Config endpoint (provides runtime environment variables to client)
app.get('/api/config', configRoute);

// Render a resource to HTML via the shared renderers library (server-side).
// The rebuild's core seam — descriptor in, HTML out.
app.get('/api/preview/html', renderHtmlHandler);
app.post('/api/preview/html', renderHtmlHandler);

// Render a resource to PDF via the library + WeasyPrint sidecar (cached).
// POST enqueues an async job; GET /:jobId polls status; GET (descriptor) serves.
app.post('/api/preview/pdf', enqueuePdf);
app.get('/api/preview/pdf/:jobId', pdfJobStatus);
app.get('/api/preview/pdf', renderPdfSync);

// API Routes (replacing Netlify functions)
app.post('/api/save-html-to-cache', saveHtmltoCacheHandler);
app.get('/api/get-cached-html', getCachedHtmlHandler);

// Direct cached page serving (fast path)
app.get('/api/cached-page', serveCachedPage);

// HTML -> PDF via the internal weasyprint-service (text/html in, application/pdf out)
app.post(
  '/api/weasyprint',
  express.text({ type: ['text/html', 'text/plain'], limit: '50mb' }),
  weasyprintHandler
);

// Serve static files from dist folder (production)
if (process.env.NODE_ENV === 'production') {
  const distPath = join(__dirname, '../dist');
  
  // Serve static files with proper cache headers
  app.use(express.static(distPath, {
    maxAge: 0, // Don't cache in development/testing
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // For hashed assets (with version in filename), cache for 1 year
      if (path.match(/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        // For HTML files, no cache
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));
  
  // SPA fallback - serve index.html for all routes
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
