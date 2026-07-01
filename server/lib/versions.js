// Version resolution + listing for a repo.
//
// resolveVersion: turn a requested version (v89 / master / a user branch / empty)
// into a concrete { ref, sha }. Empty -> the latest *release* (not prerelease, not
// a branch), falling back to the repo's default branch if it has no releases.
//
// listVersions: powers the version picker — the latest release plus (for content
// workers) all releases and branches.
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
    return null; // no releases (only branches)
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

export async function resolveVersion(owner, repo, version) {
  let ref = (version || '').trim();
  if (!ref) {
    ref = (await latestReleaseTag(owner, repo)) || (await defaultBranch(owner, repo));
  }
  const sha = await resolveCommitSha(owner, repo, ref);
  return { ref, sha };
}

export async function listVersions(owner, repo) {
  const [latestRelease, releases, branches] = await Promise.all([
    latestReleaseTag(owner, repo),
    dcsJson(`/repos/${enc(owner)}/${enc(repo)}/releases?limit=50`).catch(() => []),
    dcsJson(`/repos/${enc(owner)}/${enc(repo)}/branches?limit=100`).catch(() => []),
  ]);
  return {
    latestRelease,
    releases: (Array.isArray(releases) ? releases : [])
      .filter((r) => !r.draft)
      .map((r) => ({ tag: r.tag_name, name: r.name || r.tag_name, prerelease: !!r.prerelease })),
    branches: (Array.isArray(branches) ? branches : []).map((b) => b.name),
  };
}
