// Small DCS (gitea) API helpers.

const DCS_API_URL = process.env.DCS_API_URL || 'https://git.door43.org/api/v1';

// Resolve a ref (branch name, tag, or sha) to a concrete commit sha, so caches
// key on immutable content instead of a moving ref like "master".
export async function resolveCommitSha(owner, repo, ref) {
  const url =
    `${DCS_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` +
    `/commits?sha=${encodeURIComponent(ref)}&limit=1&stat=false&files=false`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) {
    throw new Error(`DCS commits lookup ${r.status} for ${owner}/${repo}@${ref}`);
  }
  const arr = await r.json();
  const sha = Array.isArray(arr) && arr[0] && arr[0].sha;
  if (!sha) throw new Error(`no commit found for ${owner}/${repo}@${ref}`);
  return sha;
}
