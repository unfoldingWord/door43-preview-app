// Clear the local ("mock") disk preview cache. Only removes the temp cache dir.
import { rmSync, existsSync } from 'fs';
import { CACHE_DIR } from '../server/lib/cache-disk.js';

if (existsSync(CACHE_DIR)) {
  rmSync(CACHE_DIR, { recursive: true, force: true });
  console.log(`Cleared preview cache: ${CACHE_DIR}`);
} else {
  console.log(`No preview cache at: ${CACHE_DIR}`);
}
