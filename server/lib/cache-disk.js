// Disk cache backend (dev / single instance). get/set by key + ext; handles both
// text (utf8) and binary (Buffer). Keys may contain "/" (readable layout) — parent
// dirs are created as needed.
import { promises as fs } from 'fs';
import path from 'path';

const CACHE_DIR = process.env.CACHE_DIR || path.resolve(process.cwd(), 'cache');
const PREVIEW_DIR = path.join(CACHE_DIR, 'preview');

function fileFor(key, ext) {
  return path.join(PREVIEW_DIR, `${key}.${ext}`);
}

export async function getCached(key, { ext = 'html', binary = false } = {}) {
  try {
    return await fs.readFile(fileFor(key, ext), binary ? undefined : 'utf8');
  } catch {
    return null; // miss
  }
}

export async function setCached(key, data, { ext = 'html' } = {}) {
  const file = fileFor(key, ext);
  await fs.mkdir(path.dirname(file), { recursive: true });
  // temp + rename so a concurrent reader never sees a partial file
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}
