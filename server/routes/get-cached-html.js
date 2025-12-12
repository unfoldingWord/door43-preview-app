// Converted from S3 to local filesystem caching - returns JSON directly
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pako from 'pako';
import { getVerificationKey } from '../verificationKey.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache directory is mounted as a volume in Docker
const CACHE_DIR = process.env.CACHE_DIR || path.join(__dirname, '../../cached-files');

export default async function getCachedHtmlHandler(req, res) {
  try {
    const { owner, repo, ref, bookId, verification } = req.query;

    if (!owner || !repo || !ref || !bookId) {
      return res.status(400).json({ 
        message: 'Bad Request: Missing required parameters (owner, repo, ref, bookId)' 
      });
    }

    if (verification !== getVerificationKey()) {
      return res.status(401).json({ 
        message: 'Unauthorized' 
      });
    }

    const sanitizedBookId = bookId.replace(/\s+/g, '-');
    const filePath = `u/${owner}/${repo}/${ref}/${sanitizedBookId}.json.gz`;
    const fullPath = path.join(CACHE_DIR, filePath);

    try {
      // Check if file exists
      await fs.access(fullPath);
      
      // Read the compressed file
      const compressedData = await fs.readFile(fullPath);
      
      // Decompress the data
      const decompressed = pako.ungzip(compressedData, { to: 'string' });
      const jsonData = JSON.parse(decompressed);
      
      console.log('Cached file found and served: ', filePath);
      
      // Return the JSON data directly with proper caching headers
      res.set({
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=60',
      });
      res.status(200).json(jsonData);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log('Cached file not found: ', filePath);
        res.status(404).json({ message: 'Not Found' });
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error('Get Cached File Failed: ', err);
    res.status(500).json({
      message: 'Internal Server Error',
      error: err.message,
    });
  }
}
