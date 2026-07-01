// GET /api/catalog/search — browse the DCS catalog for the resource picker.
// A thin filter + trim over the DCS catalog search API: enough for the UI to
// list resources and, per resource, its books (from ingredients) and the
// abbreviation used to build navigation anchors.
//
// Query: lang (default en), subject, owner, q, stage (default prod), limit.
import { listVersions, resolveVersion } from '../lib/versions.js';

const DCS_API_URL = process.env.DCS_API_URL || 'https://git.door43.org/api/v1';

// GET /api/catalog/entry?owner&repo&ref — one resource's metadata + books (for
// direct hot-link loads). Empty ref -> latest release.
export async function catalogEntry(req, res) {
  const { owner, repo } = req.query;
  if (!owner || !repo) {
    return res.status(400).json({ error: 'owner and repo are required.' });
  }
  try {
    const { ref } = await resolveVersion(owner, repo, req.query.ref || '');
    const url = `${DCS_API_URL}/catalog/entry/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo
    )}/${encodeURIComponent(ref)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return res.status(502).json({ error: `catalog entry not found (${r.status}) for ${owner}/${repo}@${ref}` });
    const e = await r.json();
    res.json({
      owner: e.owner,
      repo: e.name || repo,
      ref: e.branch_or_tag_name || ref,
      subject: e.subject,
      title: e.title,
      language: e.language,
      languageTitle: e.language_title,
      direction: e.language_direction || 'ltr',
      abbreviation: e.abbreviation,
      books: (e.ingredients || [])
        .map((i) => ({ id: i.identifier, title: i.title, sort: i.sort || 0 }))
        .sort((a, b) => a.sort - b.sort),
    });
  } catch (e) {
    res.status(502).json({ error: `catalog entry lookup failed for ${owner}/${repo}: ${e.message}` });
  }
}

// GET /api/catalog/versions?owner&repo — for the version picker: latest release,
// plus all releases and branches (shown when the user opts into dev versions).
export async function catalogVersions(req, res) {
  const { owner, repo } = req.query;
  if (!owner || !repo) {
    return res.status(400).json({ error: 'owner and repo are required.' });
  }
  try {
    res.json(await listVersions(owner, repo));
  } catch (e) {
    res.status(502).json({ error: `versions lookup failed for ${owner}/${repo}: ${e.message}` });
  }
}

export default async function catalogSearch(req, res) {
  const q = req.query || {};
  const params = new URLSearchParams();
  if (q.lang) params.set('lang', q.lang);
  if (q.subject) params.set('subject', q.subject);
  if (q.owner) params.set('owner', q.owner);
  if (q.q) params.set('q', q.q);
  params.set('stage', q.stage || 'prod');
  params.set('limit', String(Math.min(Number(q.limit) || 100, 300)));

  try {
    const r = await fetch(`${DCS_API_URL}/catalog/search?${params.toString()}`, {
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return res.status(502).json({ error: `catalog search failed (${r.status})` });
    const data = await r.json();
    const entries = (data.data || []).map((e) => ({
      owner: e.owner,
      repo: e.name,
      ref: e.branch_or_tag_name,
      subject: e.subject,
      title: e.title,
      language: e.language,
      languageTitle: e.language_title,
      direction: e.language_direction || 'ltr',
      abbreviation: e.abbreviation,
      books: (e.ingredients || [])
        .map((i) => ({ id: i.identifier, title: i.title, sort: i.sort || 0 }))
        .sort((a, b) => a.sort - b.sort),
    }));
    res.json({ entries });
  } catch (e) {
    res.status(502).json({ error: `catalog search failed: ${e.message}` });
  }
}
