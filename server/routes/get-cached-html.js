// Returns a cached book's JSON. The gzipped file on disk is streamed as-is (see sendCachedJson).
import { getVerificationKey } from '../verificationKey.js';
import { resolveCachePath, sendCachedJson } from '../cacheFile.js';

export default async function getCachedHtmlHandler(req, res) {
  try {
    const { owner, repo, ref, bookId, verification } = req.query;

    if (!owner || !repo || !ref || !bookId) {
      return res.status(400).json({
        message: 'Bad Request: Missing required parameters (owner, repo, ref, bookId)',
      });
    }

    if (verification !== getVerificationKey()) {
      return res.status(401).json({
        message: 'Unauthorized',
      });
    }

    const sanitizedBookId = bookId.replace(/\s+/g, '-');
    const filePath = `u/${owner}/${repo}/${ref}/${sanitizedBookId}.json.gz`;
    const fullPath = resolveCachePath(filePath);
    if (!fullPath) {
      return res.status(400).json({ message: 'Invalid Parameters' });
    }

    if (await sendCachedJson(req, res, fullPath)) {
      console.log('Cached file found and served: ', filePath);
    } else {
      console.log('Cached file not found: ', filePath);
      res.status(404).json({ message: 'Not Found' });
    }
  } catch (err) {
    console.error('Get Cached File Failed: ', err);
    if (!res.headersSent) {
      res.status(500).json({
        message: 'Internal Server Error',
        error: err.message,
      });
    }
  }
}
