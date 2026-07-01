// Composite render identity — what actually determines whether a rendered book is
// stale. A rendered resource depends on several repos (a TN pulls ULT, UST, TW, TA,
// TWL, and UGNT or UHB depending on the book), so the primary repo's commit sha is
// not enough. We combine, per resource in the FILTERED rendered set:
//
//   - book-organized repos (Bible / Aligned / Greek / Hebrew / TSV): the BLOB sha
//     of just the rendered book's file — so editing a different book (or a commit
//     that doesn't touch this book) does NOT invalidate this book's preview.
//   - Markdown repos (TW, TA, OBS, …): the repo commit sha (no per-book files).
//
// Gathering (per resolution; TTL-cached like ref->sha, so HITs pay nothing):
//   1. GET /catalog/bp/<owner>/<repo>/<ref>?book=<book> — entries + commit_sha +
//      ingredient paths. The book param selects the right Bible (Greek vs Hebrew).
//   2. Filter to the subjects the main resource needs (library's requiredSubjectsMap)
//      + at most two Aligned Bibles (ult/glt + ust/gst).
//   3. For each book-file repo: git/trees/<commit_sha> (immutable per commit ->
//      cached forever) to read the book file's blob sha.
//   4. composite = sha256(sorted per-resource contributions).
import { createHash } from 'crypto';
import { requiredSubjectsMap } from '@unfoldingword/door43-preview-renderers';
import { resolveVersion } from './versions.js';

const enc = (s) => encodeURIComponent(s);
const BRANCH_TTL = Number(process.env.REF_SHA_TTL_MS) || 15000;
const TAG_TTL = Number(process.env.REF_SHA_TAG_TTL_MS) || 24 * 60 * 60 * 1000;

// Subjects organized one-file-per-book -> identity uses the book's blob sha.
// Everything else (Translation Words, Translation Academy, Open Bible Stories and
// its OBS-* variants, …) falls back to the repo commit sha.
const BOOK_FILE_SUBJECTS = new Set([
  'Bible',
  'Aligned Bible',
  'Hebrew Old Testament',
  'Greek New Testament',
  'TSV Translation Notes',
  'TSV Translation Questions',
  'TSV Translation Words Links',
  'TSV Study Notes',
  'TSV Study Questions',
]);

function ttlFor(requestedRef) {
  const r = String(requestedRef || '').trim();
  if (!r) return BRANCH_TTL; // empty -> latest release, which changes on a new release
  return /^v?\d+([._-]\d+)*$/i.test(r) ? TAG_TTL : BRANCH_TTL;
}

const normPath = (p) => String(p || '').replace(/^\.?\//, '');

// --- filtered rendered set (mirrors the library's getFilteredCatalogEntries) ---
function selectAlignedBibles(entries) {
  if (entries.length <= 2) return entries;
  const literal = entries.find((e) => ['ult', 'glt'].includes(e.abbreviation));
  const simplified = entries.find((e) => ['ust', 'gst'].includes(e.abbreviation));
  if (literal && simplified) return [literal, simplified];
  if (literal) return [literal, entries.find((e) => e !== literal) || literal];
  if (simplified) return [entries.find((e) => e !== simplified) || simplified, simplified];
  return entries.slice(0, 2);
}

function selectEntries(catalogEntries) {
  const main = catalogEntries[0];
  if (!main) return [];
  const required = requiredSubjectsMap[main.subject];
  // No required subjects -> standalone render (Bible, Aligned Bible, TW, TA, OBS…):
  // the library's handlers use only the main entry, so its identity is just itself.
  if (!required || required.length === 0) return [main];
  const bibles = [];
  const others = [];
  for (let i = 1; i < catalogEntries.length; i++) {
    const e = catalogEntries[i];
    if (!required.includes(e.subject)) continue;
    if (e.subject === 'Aligned Bible') bibles.push(e);
    else others.push(e);
  }
  const selBibles = required.includes('Aligned Bible') ? selectAlignedBibles(bibles) : [];
  return [main, ...selBibles, ...others];
}

// --- blueprint fetch (with the book param, so the right Bible is chosen) ---
const DEFAULT_API = 'https://qa.door43.org/api/v1';
async function fetchBlueprint(owner, repo, ref, books, api) {
  const q = (books || []).map((b) => `book=${enc(b)}`).join('&');
  const url = `${api}/catalog/bp/${enc(owner)}/${enc(repo)}/${enc(ref)}${q ? `?${q}` : ''}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`catalog/bp ${r.status} for ${owner}/${repo}@${ref}`);
  const j = await r.json();
  const entries = j && j.data;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`catalog/bp returned no entries for ${owner}/${repo}@${ref}`);
  }
  return entries;
}

// --- git tree cache (immutable per commit sha -> cache forever, bounded) ---
const treeCache = new Map(); // `${api}|${owner}/${repo}|${commitSha}` -> Map(path -> blobSha)

async function repoRootTree(owner, repo, commitSha, api) {
  const ck = `${api}|${owner}/${repo}|${commitSha}`;
  const cached = treeCache.get(ck);
  if (cached) return cached;
  const url = `${api}/repos/${enc(owner)}/${enc(repo)}/git/trees/${enc(commitSha)}?recursive=false&per_page=1000`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`git/trees ${r.status} for ${owner}/${repo}@${commitSha}`);
  const j = await r.json();
  const map = new Map();
  for (const t of j.tree || []) map.set(t.path, t.sha);
  if (treeCache.size > 3000) treeCache.clear();
  treeCache.set(ck, map);
  return map;
}

// Fallback for a file not at the repo root: contents-ext exposes file_contents.sha.
async function contentsExtSha(owner, repo, path, ref, api) {
  try {
    const url = `${api}/repos/${enc(owner)}/${enc(repo)}/contents-ext/${path}?ref=${enc(ref)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.file_contents && j.file_contents.sha) || null;
  } catch {
    return null;
  }
}

async function blobShaFor(owner, repo, commitSha, path, api) {
  try {
    const tree = await repoRootTree(owner, repo, commitSha, api);
    if (tree.has(path)) return tree.get(path);
  } catch {
    /* fall through to contents-ext */
  }
  return contentsExtSha(owner, repo, path, commitSha, api);
}

// Per-resource contribution to the composite (a file blob sha for book-organized
// repos, else the repo commit sha). Falls back to commit sha when a book file can't
// be resolved — safe (worst case: re-render when the repo commits).
async function contributionFor(entry, books, api) {
  const kind = `${entry.owner}/${entry.name}`;
  const commit = `${kind}#commit:${entry.commit_sha}`;
  if (!books.length || !BOOK_FILE_SUBJECTS.has(entry.subject)) return commit;

  const parts = [];
  for (const book of books) {
    const ing = (entry.ingredients || []).find((i) => i.identifier === book && !i.is_dir);
    if (!ing) return commit; // book not in this repo (e.g. UHB for a NT book) -> whole-repo
    const blob = await blobShaFor(entry.owner, entry.name, entry.commit_sha, normPath(ing.path), api);
    if (!blob) return commit; // couldn't resolve the blob -> safe fallback
    parts.push(`${book}=${blob}`);
  }
  return `${kind}#file:${parts.sort().join(',')}`;
}

async function computeComposite(entries, books, api) {
  const contributions = await Promise.all(entries.map((e) => contributionFor(e, books, api)));
  return createHash('sha256').update(contributions.sort().join('\n')).digest('hex').slice(0, 40);
}

// --- identity cache (TTL, like ref->sha) ---
const identityCache = new Map(); // key -> { value: {version, composite}, exp }
function prune() {
  if (identityCache.size <= 5000) return;
  const now = Date.now();
  for (const [k, v] of identityCache) if (v.exp <= now) identityCache.delete(k);
  if (identityCache.size > 5000) identityCache.clear();
}

/**
 * Resolve the composite render identity for a (resource, ref, books) render.
 * @returns {Promise<{version: string, composite: string, entries: Array|null}>}
 *   version   the concrete ref used (empty -> latest release tag)
 *   composite the staleness identity (sha256 of per-resource contributions)
 *   entries   the filtered rendered set when freshly fetched (null on a cache hit)
 */
export async function resolveRenderIdentity({ owner, repo, ref = '', books = [], api = DEFAULT_API }) {
  const requested = (ref || '').trim();
  const bookList = (books || []).filter(Boolean);
  const booksKey = bookList.slice().sort().join('+') || '_whole';
  const ck = `${api}|${owner}|${repo}|${requested}|${booksKey}`;
  const hit = identityCache.get(ck);
  if (hit && hit.exp > Date.now()) return { ...hit.value, entries: null };

  // Concrete ref for the /bp/ call (empty -> latest release tag; resolveVersion is cached).
  let version = requested;
  if (!version) version = (await resolveVersion(owner, repo, '', api)).ref;

  const allEntries = await fetchBlueprint(owner, repo, version, bookList, api);
  const entries = selectEntries(allEntries);
  const composite = await computeComposite(entries, bookList, api);

  const value = { version, composite };
  identityCache.set(ck, { value, exp: Date.now() + ttlFor(requested) });
  prune();
  return { version, composite, entries };
}
