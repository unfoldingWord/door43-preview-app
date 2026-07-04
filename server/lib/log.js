// Leveled logging with a single verbosity switch.
//
//   DEBUG_MODE=1 (or VERBOSE_MODE=1) -> everything, including the per-request access
//   log, cache HIT/MISS timings, what's being downloaded, and each render.
//
//   off (default) -> only lifecycle worth seeing on a quiet server: startup, cron
//   cycle start/stop + summaries, and warnings/errors (e.g. a render that failed).
//
// Usage: import { log } from './log.js'; log.debug(...) / log.info(...) /
// log.warn(...) / log.error(...). Existing message prefixes ([html-data], [pdf],
// [warm-cron], …) are kept, so grep-ability is unchanged.
const DEBUG = /^(1|true|on|yes|debug|verbose)$/i.test(
  process.env.DEBUG_MODE || process.env.VERBOSE_MODE || ''
);

export const debugEnabled = DEBUG;

export const log = {
  debugEnabled: DEBUG,
  debug: DEBUG ? (...args) => console.log(...args) : () => {},
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

export default log;
