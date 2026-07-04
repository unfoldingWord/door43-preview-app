// Scheduled cache warming. On an interval, list the latest official releases from
// the catalog and warm any PDFs not already cached (warmResource is idempotent, so
// each cycle only tops up what's missing). Paced by a per-cycle enqueue cap so the
// first run can't flood the queue; subsequent cycles fill the rest.
//
// Off unless configured. A master switch gates ALL crons:
//   RUN_CRONS=1                  REQUIRED — without it the container runs no crons
//                                and warms nothing on its own.
// Then, to schedule warming specifically:
//   WARM_CRON=on                 enable (also enabled if WARM_INTERVAL_MS > 0)
//   WARM_INTERVAL_MS             cycle interval (required to schedule; e.g. 3600000)
//   WARM_DCS_HOST                host to warm from (PROD|QA|DEV|URL; default = app default)
//   WARM_SEARCH_LIMIT            catalog/search limit (default 100)
//   WARM_SEARCH_QUERY            extra search params, e.g. "subject=Aligned%20Bible&lang=en"
//   WARM_MAX_ENQUEUE_PER_CYCLE   stop a cycle after ~this many PDFs enqueued (default 200)
//   WARM_FIRST_DELAY_MS          delay before the first cycle (default 10000)
import { warmResource } from './warm.js';
import { resolveDcsHost, dcsApiUrl } from './dcs-host.js';
import { log } from './log.js';

const RUN_CRONS = /^(1|true|on|yes)$/i.test(process.env.RUN_CRONS || ''); // master switch
const INTERVAL = Number(process.env.WARM_INTERVAL_MS) || 0;
const WARM_ENABLED = /^(1|true|on|yes)$/i.test(process.env.WARM_CRON || '') || INTERVAL > 0;
const LIMIT = Number(process.env.WARM_SEARCH_LIMIT) || 100;
const MAX_ENQUEUE = Number(process.env.WARM_MAX_ENQUEUE_PER_CYCLE) || 200;
const FIRST_DELAY = Number(process.env.WARM_FIRST_DELAY_MS) || 10000;
const EXTRA = (process.env.WARM_SEARCH_QUERY || '').replace(/^[?&]/, '');

function warmApi() {
  const h = process.env.WARM_DCS_HOST;
  return dcsApiUrl(h ? resolveDcsHost({ server: h }) : resolveDcsHost({}));
}

let running = false;

// One warming pass over the latest releases. Exported for testing.
export async function runWarmCycle() {
  if (running) {
    log.info('[warm-cron] previous cycle still running; skipping');
    return { skipped: true };
  }
  running = true;
  try {
    const api = warmApi();
    const url = `${api}/catalog/search?stage=prod&limit=${LIMIT}${EXTRA ? `&${EXTRA}` : ''}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`catalog/search ${r.status}`);
    const releases = (await r.json()).data || [];
    log.info(`[warm-cron] cycle start: ${releases.length} releases from ${api}`);

    let enqueued = 0;
    let checked = 0;
    for (const e of releases) {
      try {
        const m = await warmResource({ owner: e.owner, repo: e.name, ref: e.branch_or_tag_name || '', api });
        checked++;
        enqueued += m.pending;
        if (m.pending) {
          log.debug(`[warm-cron] ${e.owner}/${e.name}@${m.version}: +${m.pending} enqueued (${m.cached}/${m.total} cached)`);
        }
      } catch (err) {
        log.warn(`[warm-cron] ${e.owner}/${e.name}: ${err.message}`);
      }
      if (enqueued >= MAX_ENQUEUE) {
        log.info(`[warm-cron] hit cap (${MAX_ENQUEUE} enqueued); resuming next cycle`);
        break;
      }
    }
    log.info(`[warm-cron] cycle done: ${checked} resources checked, ${enqueued} PDFs enqueued`);
    return { checked, enqueued };
  } catch (e) {
    log.warn(`[warm-cron] cycle failed: ${e.message}`);
    return { error: e.message };
  } finally {
    running = false;
  }
}

export function startWarmCron() {
  if (!RUN_CRONS) return; // master switch off -> no crons at all
  if (!WARM_ENABLED) return;
  if (!INTERVAL) {
    log.info('[warm-cron] enabled but WARM_INTERVAL_MS not set; not scheduling');
    return;
  }
  log.info(`[warm-cron] every ${INTERVAL}ms, <=${MAX_ENQUEUE} PDFs/cycle, host ${warmApi()}`);
  const first = setTimeout(runWarmCycle, FIRST_DELAY);
  const tick = setInterval(runWarmCycle, INTERVAL);
  // Don't hold the process open solely for these timers.
  if (first.unref) first.unref();
  if (tick.unref) tick.unref();
}
