// Version resolution + tag/branch listing, using the lightweight git endpoints
// (/repos/.../tags, /repos/.../branches, /releases/latest) — fast, and users can
// pick any ref even if it isn't renderable (the render just reports an error).
//
// Every function takes the DCS API base URL (…/api/v1) so the host can vary per
// request (?server=, DCS_HOST). It defaults to the env / QA default when omitted.
import { resolveCommitSha } from './dcs.js';
import { resolveDcsHost, dcsApiUrl } from './dcs-host.js';

const DEFAULT_API = dcsApiUrl(resolveDcsHost({}));
const enc = (s) => encodeURIComponent(s);

async function dcsJson(api, pathAndQuery) {
  const r = await fetch(`${api}${pathAndQuery}`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`DCS ${r.status} for ${pathAndQuery}`);
  return r.json();
}

// Latest published, non-draft, non-prerelease release tag, or null if none.
export async function latestReleaseTag(owner, repo, api = DEFAULT_API) {
  try {
    const rel = await dcsJson(api, `/repos/${enc(owner)}/${enc(repo)}/releases/latest`);
    return rel && rel.tag_name ? rel.tag_name : null;
  } catch {
    return null;
  }
}

async function defaultBranch(owner, repo, api) {
  try {
    const info = await dcsJson(api, `/repos/${enc(owner)}/${enc(repo)}`);
    return (info && info.default_branch) || 'master';
  } catch {
    return 'master';
  }
}

// --- ref -> {ref, sha} resolution cache -------------------------------------
// resolveVersion runs on every preview request (html + nav + status), so a single
// page load resolves the same ref several times. Cache the result briefly to
// collapse those into one DCS lookup and let cache HITs avoid DCS entirely.
//
// TTL: immutable release tags (vNN, vNN.NN) never move -> long. Branches and the
// empty "latest release" ref can move -> short, so a moved branch is detected (and
// serve-stale kicks in) within that window. Both env-tunable; lower REF_SHA_TTL_MS
// for snappier branch-change detection while testing.
const shaCache = new Map(); // `${api}|${owner}|${repo}|${requested}` -> { value, exp }
const BRANCH_TTL = Number(process.env.REF_SHA_TTL_MS) || 15000;
const TAG_TTL = Number(process.env.REF_SHA_TAG_TTL_MS) || 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 5000;

function ttlFor(requestedRef) {
  const r = String(requestedRef || '').trim();
  if (!r) return BRANCH_TTL; // empty -> latest release, which changes on a new release
  return /^v?\d+([._-]\d+)*$/i.test(r) ? TAG_TTL : BRANCH_TTL;
}

function prune() {
  if (shaCache.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [k, v] of shaCache) if (v.exp <= now) shaCache.delete(k);
  if (shaCache.size > MAX_ENTRIES) shaCache.clear(); // hard reset if still oversized
}

// Resolve a requested version to { ref, sha }. Empty -> latest release, else the
// repo's default branch. Cached per (host, owner, repo, requested ref).
export async function resolveVersion(owner, repo, version, api = DEFAULT_API) {
  const requested = (version || '').trim();
  const ck = `${api}|${owner}|${repo}|${requested}`;
  const hit = shaCache.get(ck);
  if (hit && hit.exp > Date.now()) return hit.value;

  let ref = requested;
  if (!ref) {
    ref = (await latestReleaseTag(owner, repo, api)) || (await defaultBranch(owner, repo, api));
  }
  const sha = await resolveCommitSha(owner, repo, ref, api);
  const value = { ref, sha };
  shaCache.set(ck, { value, exp: Date.now() + ttlFor(requested) });
  prune();
  return value;
}

// Tag names, newest-first by tag commit date.
export async function listTags(owner, repo, api = DEFAULT_API, limit = 300) {
  const tags = await dcsJson(api, `/repos/${enc(owner)}/${enc(repo)}/tags?limit=${limit}`).catch(() => []);
  return (Array.isArray(tags) ? tags : [])
    .map((t) => ({ name: t.name, date: (t.commit && t.commit.created) || '' }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .map((t) => t.name);
}

// Branch names: master then main pinned on top, then the rest newest-first by
// last-commit date.
export async function listBranches(owner, repo, api = DEFAULT_API, limit = 300) {
  const branches = await dcsJson(api, `/repos/${enc(owner)}/${enc(repo)}/branches?limit=${limit}`).catch(() => []);
  const list = (Array.isArray(branches) ? branches : []).map((b) => ({
    name: b.name,
    date: (b.commit && (b.commit.timestamp || (b.commit.author && b.commit.author.date))) || '',
  }));
  const PINNED = ['master', 'main'];
  const rank = (n) => {
    const i = PINNED.indexOf(n);
    return i === -1 ? PINNED.length : i;
  };
  list.sort((a, b) => rank(a.name) - rank(b.name) || (b.date || '').localeCompare(a.date || ''));
  return list.map((b) => b.name);
}
