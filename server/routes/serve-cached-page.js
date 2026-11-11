import { getVerificationKey } from '../verificationKey.js';
import { resolveCachePath, sendCachedJson } from '../cacheFile.js';

/**
 * Serve a fully rendered page from cache
 * Route: /api/cached-page?owner=&repo=&ref=&book=
 * Query params: book is optional and defaults to 'default'
 *
 * On a hit the response body is the cached book JSON itself (the gzipped file on disk is
 * streamed as-is, see sendCachedJson). On a miss it is a 404 with { cached: false }.
 */
export default async function serveCachedPage(req, res) {
  try {
    const { owner, repo, ref, verification } = req.query;
    const book = req.query.book || 'default';
    const actualRef = ref || 'master';

    if (verification != getVerificationKey()) {
      return res.status(401).json({
        cached: false,
        message: 'Unauthorized',
      });
    }

    if (!owner || !repo) {
      return res.status(400).json({ cached: false, message: 'Bad Request: Missing required parameters (owner, repo)' });
    }

    const filePath = resolveCachePath(`u/${owner}/${repo}/${actualRef}/${book}.json.gz`);
    if (!filePath) {
      return res.status(400).json({ cached: false, message: 'Invalid Parameters' });
    }

    console.log(`Attempting to serve cached page: ${filePath}`);

    if (!(await sendCachedJson(req, res, filePath))) {
      console.log(`Cached file not found: ${filePath}`);
      // File doesn't exist, tell React to render it fresh
      return res.status(404).json({
        cached: false,
        message: 'No cached version available, will render fresh',
      });
    }
  } catch (error) {
    console.error('Error serving cached page:', error);
    if (!res.headersSent) {
      res.status(500).json({
        cached: false,
        error: error.message,
      });
    }
  }
}
