// Version resolution + tag/branch listing, using the lightweight git endpoints
// (/repos/.../tags, /repos/.../branches, /releases/latest) — fast, and users can
// pick any ref even if it isn't renderable (the render just reports an error).
import { resolveCommitSha } from './dcs.js';

const DCS_API_URL = process.env.DCS_API_URL || 'https://git.door43.org/api/v1';
const enc = (s) => encodeURIComponent(s);

async function dcsJson(pathAndQuery) {
  const r = await fetch(`${DCS_API_URL}${pathAndQuery}`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`DCS ${r.status} for ${pathAndQuery}`);
  return r.json();
}

// Latest published, non-draft, non-prerelease release tag, or null if none.
export async function latestReleaseTag(owner, repo) {
  try {
    const rel = await dcsJson(`/repos/${enc(owner)}/${enc(repo)}/releases/latest`);
    return rel && rel.tag_name ? rel.tag_name : null;
  } catch {
    return null;
  }
}

async function defaultBranch(owner, repo) {
  try {
    const info = await dcsJson(`/repos/${enc(owner)}/${enc(repo)}`);
    return (info && info.default_branch) || 'master';
  } catch {
    return 'master';
  }
}

// Resolve a requested version to { ref, sha }. Empty -> latest release, else the
// repo's default branch.
export async function resolveVersion(owner, repo, version) {
  let ref = (version || '').trim();
  if (!ref) {
    ref = (await latestReleaseTag(owner, repo)) || (await defaultBranch(owner, repo));
  }
  const sha = await resolveCommitSha(owner, repo, ref);
  return { ref, sha };
}

// Tag names, newest-first by tag commit date.
export async function listTags(owner, repo, limit = 300) {
  const tags = await dcsJson(`/repos/${enc(owner)}/${enc(repo)}/tags?limit=${limit}`).catch(() => []);
  return (Array.isArray(tags) ? tags : [])
    .map((t) => ({ name: t.name, date: (t.commit && t.commit.created) || '' }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .map((t) => t.name);
}

// Branch names: master then main pinned on top, then the rest newest-first by
// last-commit date.
export async function listBranches(owner, repo, limit = 300) {
  const branches = await dcsJson(`/repos/${enc(owner)}/${enc(repo)}/branches?limit=${limit}`).catch(() => []);
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
