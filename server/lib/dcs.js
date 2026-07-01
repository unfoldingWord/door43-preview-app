// Small DCS (gitea) API helpers.
import { resolveDcsHost, dcsApiUrl } from './dcs-host.js';

// Default when no per-request host is threaded in (e.g. tests): env / QA default.
const DEFAULT_API = dcsApiUrl(resolveDcsHost({}));

// Resolve a ref (branch name, tag, or sha) to a concrete commit sha, so caches
// key on immutable content instead of a moving ref like "master".
export async function resolveCommitSha(owner, repo, ref, api = DEFAULT_API) {
  const url =
    `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` +
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
