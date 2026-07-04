// Client-side verbose logging — the browser mirror of the server's DEBUG_MODE.
//
// Enable:  add ?debug=1 to the URL (persists to localStorage across reloads),
//          or set localStorage.DEBUG_MODE = '1' in devtools.
// Disable: ?debug=0 (clears it), or remove the localStorage key.
//
// Off (default): quiet — only warnings/errors reach the console.
// On: logs what the client fetches and renders (nav, web view, PDF job, freshness).
let enabled = false;
try {
  const params = new URLSearchParams(window.location.search);
  if (params.has('debug')) {
    const v = (params.get('debug') || '1').toLowerCase();
    if (['0', 'false', 'off', 'no'].includes(v)) localStorage.removeItem('DEBUG_MODE');
    else localStorage.setItem('DEBUG_MODE', '1');
  }
  enabled = localStorage.getItem('DEBUG_MODE') === '1';
} catch {
  /* no window/localStorage (tests/SSR) -> stay off */
}

export const DEBUG = enabled;

const STYLE = 'color:#31ADE3;font-weight:bold'; // unfoldingWord Inspire blue

export function dbg(...args) {
  if (enabled) console.debug('%c[preview]', STYLE, ...args);
}
export function dwarn(...args) {
  console.warn('[preview]', ...args);
}
export function derror(...args) {
  console.error('[preview]', ...args);
}

if (enabled) console.info('%c[preview] DEBUG mode on', STYLE);
