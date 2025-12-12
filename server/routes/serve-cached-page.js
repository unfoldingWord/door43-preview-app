import { promises as fs } from 'fs';
import path from 'path';
import pako from 'pako';
import { getVerificationKey } from '../verificationKey';

const CACHE_DIR = process.env.CACHE_DIR || './cached-files';

/**
 * Serve a fully rendered page from cache
 * Route: /u/:owner/:repo/:ref?
 * Query params: ?book=<bookId> (optional, defaults to 'default')
 */
export default async function serveCachedPage(req, res) {
  try {
    const { owner, repo, ref, verification } = req.params;
    const book = req.query.book || 'default';
    const actualRef = ref || 'master';

    if (verification !== getVerificationKey()) {
      return res.status(401).json({ 
        cached: false, 
        message: 'Unauthorized' 
      });
    }

    const filePath = path.join(CACHE_DIR, 'u', owner, repo, actualRef, `${book}.json.gz`);

    console.log(`Attempting to serve cached page: ${filePath}`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      console.log(`Cached file not found: ${filePath}`);
      // File doesn't exist, return null to indicate React should handle it
      return res.status(404).json({ 
        cached: false, 
        message: 'No cached version available, will render fresh' 
      });
    }

    // Read and decompress the cached file
    const compressedData = await fs.readFile(filePath);
    const jsonString = pako.inflate(compressedData, { to: 'string' });
    const cachedData = JSON.parse(jsonString);

    // Return the cached data as JSON for React to use
    res.json({
      cached: true,
      data: cachedData
    });

  } catch (error) {
    console.error('Error serving cached page:', error);
    res.status(500).json({ 
      cached: false, 
      error: error.message 
    });
  }
}
