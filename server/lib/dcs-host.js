// Resolve which DCS (gitea) host to talk to — per request, so the app can be
// pointed at QA / DEV / a custom instance without a redeploy.
//
// Precedence (first that applies wins):
//   1. ?server=<full URL>     e.g. ?server=https://git.wc.com   -> that origin
//   2. ?server=<keyword>      PROD | QA | DEV | DEVELOP (case-insensitive)
//   3. DCS_HOST env var       a bare origin, e.g. https://qa.door43.org
//      (DCS_API_URL, the older …/api/v1 form, is still honored for back-compat)
//   4. app served on preview.door43.org  -> https://git.door43.org (PROD)
//   5. default                            -> https://qa.door43.org
//
// resolveDcsHost() returns a bare origin (no /api/v1); dcsApiUrl() appends the path.

const KEYWORD_HOSTS = {
  PROD: 'https://git.door43.org',
  QA: 'https://qa.door43.org',
  DEV: 'https://develop.door43.org',
  DEVELOP: 'https://develop.door43.org',
};

const stripTrailingSlash = (u) => String(u).replace(/\/+$/, '');

export function resolveDcsHost({ server = '', appHost = '' } = {}) {
  const s = String(server || '').trim();
  if (s) {
    if (/^https?:\/\//i.test(s)) return stripTrailingSlash(s); // 1: explicit full URL
    const kw = KEYWORD_HOSTS[s.toUpperCase()];
    if (kw) return kw; // 2: keyword
    // Anything else (not a URL, not a known keyword) is ignored -> fall through.
  }

  // 3: env. DCS_HOST (bare origin) preferred; DCS_API_URL (…/api/v1) for back-compat.
  const envHost = String(process.env.DCS_HOST || '').trim();
  if (envHost) return stripTrailingSlash(envHost);
  const envApi = String(process.env.DCS_API_URL || '').trim();
  if (envApi) return stripTrailingSlash(envApi).replace(/\/api\/v1$/i, '');

  // 4: the production app (preview.door43.org) talks to production DCS.
  const host = String(appHost || '').split(':')[0].toLowerCase();
  if (host === 'preview.door43.org') return 'https://git.door43.org';

  // 5: default.
  return 'https://qa.door43.org';
}

export function dcsApiUrl(host) {
  return `${stripTrailingSlash(host)}/api/v1`;
}

// Short label for the host (used to namespace the cache so a ?server=QA request
// never serves content cached from a different host). e.g. "qa.door43.org".
export function dcsHostLabel(apiOrHost) {
  try {
    return new URL(apiOrHost).host;
  } catch {
    return 'dcs';
  }
}

// Resolve straight from an Express request (query ?server= or a POST body.server,
// plus the Host header for the preview.door43.org rule). Returns the …/api/v1 URL.
export function dcsApiUrlFromReq(req) {
  const q = (req && req.query) || {};
  const b = (req && req.body) || {};
  const server = q.server || b.server || '';
  const appHost = req && typeof req.get === 'function' ? req.get('host') : '';
  return dcsApiUrl(resolveDcsHost({ server, appHost }));
}
