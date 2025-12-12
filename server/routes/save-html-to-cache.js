// Converted from S3 to local filesystem caching
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getVerificationKey } from '../verificationKey.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache directory is mounted as a volume in Docker
const CACHE_DIR = process.env.CACHE_DIR || path.join(__dirname, '../../cached-files');

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating cache directory:', err);
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

    // Ensure cache directory exists
    await ensureCacheDir();

    // Create full file path
    const fullPath = path.join(CACHE_DIR, filePath);
    const dirPath = path.dirname(fullPath);

    // Create directory structure if it doesn't exist
    await fs.mkdir(dirPath, { recursive: true });

    // Write file to disk
    await fs.writeFile(fullPath, bodyBuffer);
    
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
