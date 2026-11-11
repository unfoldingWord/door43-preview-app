// Saves a gzipped cached book to the local filesystem cache.
//
// Large books are sent in several requests so that no single request body exceeds the
// reverse proxy's limit (nginx rejects bodies over 1MB by default with a 413). The client
// adds uploadId, chunk (0-based) and chunks to the query; the parts are appended to a
// temporary file which replaces the real cache file once the last chunk has arrived.
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getVerificationKey } from '../verificationKey.js';
import { resolveCachePath } from '../cacheFile.js';

const MAX_CHUNKS = 500;
const STALE_PART_MS = 60 * 60 * 1000;

// Remove leftovers of uploads that were abandoned part way through
async function removeStaleParts(dirPath) {
  try {
    const now = Date.now();
    for (const name of await fs.readdir(dirPath)) {
      if (!name.endsWith('.part')) {
        continue;
      }
      const partPath = path.join(dirPath, name);
      const stat = await fs.stat(partPath);
      if (now - stat.mtimeMs > STALE_PART_MS) {
        await fs.unlink(partPath);
      }
    }
  } catch (err) {
    console.error('Error removing stale upload parts:', err);
  }
}

export default async function saveHtmltoCacheHandler(req, res) {
  try {
    const verification = req.query.verification || '';

    if (verification !== getVerificationKey()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const filePath = req.query.path;

    if (!filePath || !filePath.startsWith('u/') || !filePath.endsWith('.json.gz')) {
      return res.status(400).json({ message: 'Invalid Parameters' });
    }

    // Get the body buffer
    let bodyBuffer;
    if (Buffer.isBuffer(req.body)) {
      bodyBuffer = req.body;
    } else if (typeof req.body === 'string') {
      bodyBuffer = Buffer.from(req.body, 'base64');
    } else {
      bodyBuffer = Buffer.from(JSON.stringify(req.body));
    }

    const fullPath = resolveCachePath(filePath);
    if (!fullPath) {
      return res.status(400).json({ message: 'Invalid Parameters' });
    }
    const dirPath = path.dirname(fullPath);

    const chunks = parseInt(req.query.chunks || '1', 10);
    const chunk = parseInt(req.query.chunk || '0', 10);
    const uploadId = req.query.uploadId || crypto.randomBytes(8).toString('hex');

    if (!(chunks >= 1 && chunks <= MAX_CHUNKS) || !(chunk >= 0 && chunk < chunks) || !/^[a-zA-Z0-9]{6,40}$/.test(uploadId)) {
      return res.status(400).json({ message: 'Invalid Parameters' });
    }

    // Create directory structure if it doesn't exist
    await fs.mkdir(dirPath, { recursive: true });

    const partPath = `${fullPath}.${uploadId}.part`;

    if (chunk === 0) {
      await removeStaleParts(dirPath);
      await fs.writeFile(partPath, bodyBuffer);
    } else {
      try {
        await fs.access(partPath);
      } catch {
        return res.status(409).json({ message: 'Upload not started: chunk 0 has not been received' });
      }
      await fs.appendFile(partPath, bodyBuffer);
    }

    if (chunk < chunks - 1) {
      return res.status(200).json({ message: 'Chunk Received', path: filePath, chunk, chunks });
    }

    // Last (or only) chunk: swap the finished file into place so readers never see a partial file
    await fs.rename(partPath, fullPath);

    console.log('Cache Success: ', { path: filePath, fullPath });
    
    res.status(200).json({
      message: 'Cache Success',
      path: filePath,
    });
  } catch (err) {
    console.error('Cache Failed: ', err);
    res.status(400).json({
      message: 'Cache Failed',
      error: err.message,
    });
  }
}
