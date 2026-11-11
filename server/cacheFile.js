// Shared helpers for reading/writing the gzipped JSON cache files under CACHE_DIR
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cache directory is mounted as a volume in Docker
export const CACHE_DIR = path.resolve(process.env.CACHE_DIR || path.join(__dirname, '../cached-files'));

/**
 * Resolve a relative cache path (e.g. u/owner/repo/ref/book.json.gz) to an absolute
 * path inside CACHE_DIR. Returns null if it would land outside CACHE_DIR.
 */
export function resolveCachePath(relativePath) {
  const fullPath = path.resolve(CACHE_DIR, relativePath);
  if (!fullPath.startsWith(CACHE_DIR + path.sep)) {
    return null;
  }
  return fullPath;
}

/**
 * Send a cached .json.gz file as JSON. The bytes on disk are already gzipped, so they are
 * streamed as-is with `Content-Encoding: gzip` and the browser inflates them. This keeps
 * the response as small as the file on disk and avoids inflating + re-serializing a large
 * JSON document on every request.
 *
 * Returns false (without responding) if the file does not exist.
 */
export async function sendCachedJson(req, res, fullPath) {
  let stat;
  try {
    stat = await fs.stat(fullPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false;
    }
    throw err;
  }

  res.status(200);
  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'max-age=60',
    Vary: 'Accept-Encoding',
  });

  const fileStream = createReadStream(fullPath);
  fileStream.on('error', (err) => {
    console.error('Error reading cached file:', fullPath, err);
    res.destroy(err);
  });

  if (req.acceptsEncodings('gzip')) {
    res.set({ 'Content-Encoding': 'gzip', 'Content-Length': stat.size });
    fileStream.pipe(res);
  } else {
    // Client can't take gzip (rare; e.g. plain curl), so inflate on the way out
    fileStream.pipe(zlib.createGunzip()).pipe(res);
  }
  return true;
}
