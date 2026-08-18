// BullMQ/Redis job-queue backend: production. Jobs persist in Redis, survive
// restarts, and can be processed by multiple worker containers. Same async
// surface as the in-process backend: enqueue(id, data) / getJob(id).
//
// Connection: REDIS_URL (redis://[user:pass@]host:port[/db]) or REDIS_HOST/PORT,
// plus REDIS_DB to pin a dedicated DB index (isolate from other Redis users such
// as DCS). The in-process worker runs here unless PREVIEW_WORKER=off, so a
// dedicated worker container can own processing instead.
import { Queue, Worker } from 'bullmq';
import { log } from './log.js';

function connectionOptions() {
  // maxRetriesPerRequest must be null for BullMQ's blocking operations.
  const opts = { maxRetriesPerRequest: null };
  if (process.env.REDIS_URL) {
    const u = new URL(process.env.REDIS_URL);
    opts.host = u.hostname;
    opts.port = u.port ? Number(u.port) : 6379;
    if (u.username) opts.username = decodeURIComponent(u.username);
    if (u.password) opts.password = decodeURIComponent(u.password);
    const p = u.pathname.replace(/^\//, '');
    if (p) opts.db = Number(p);
  } else {
    opts.host = process.env.REDIS_HOST || '127.0.0.1';
    opts.port = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379;
  }
  if (process.env.REDIS_DB) opts.db = Number(process.env.REDIS_DB);
  return opts;
}

// Map BullMQ's fine-grained states onto our coarse API states.
const STATE_MAP = {
  waiting: 'queued',
  'waiting-children': 'queued',
  prioritized: 'queued',
  delayed: 'queued',
  paused: 'queued',
  active: 'active',
  completed: 'completed',
  failed: 'failed',
};

// How long a worker may hold a job before BullMQ assumes it died. MUST exceed the
// slowest realistic PDF render: whole-resource TSV documents take minutes (a whole
// en_obs-tn has been measured at 216s), and BullMQ's default is only 30s.
//
// Renewal can't be relied on to cover the gap — BullMQ renews the lock on an event-loop
// timer, and paged-HTML assembly is CPU-bound enough to starve it. So this has to be
// long enough for the WHOLE job, not just a renewal interval. When the lock does expire
// the failure is nasty and silent: the job is re-queued and rendered a second time, then
// the original's moveToFinished fails ("Missing lock"), so the job never reaches
// `completed` and clients poll "Rendering PDF…" indefinitely even though the PDF was
// built and cached.
const LOCK_MS = Number(process.env.PREVIEW_JOB_LOCK_MS) || 15 * 60 * 1000;

// How long a failed job must sit before a re-request retries it instead of reporting
// the failure. Long enough that a client polling a broken render sees `failed` rather
// than an endless queued/active cycle; short enough that the next run retries.
const RETRY_FAILED_AFTER_MS = Number(process.env.PREVIEW_JOB_RETRY_FAILED_AFTER_MS) || 5 * 60 * 1000;

export function createRedisQueue({ name, processor, concurrency = 2 }) {
  const queue = new Queue(name, {
    connection: connectionOptions(),
    // Cap the job-events stream. BullMQ appends an entry per lifecycle transition and
    // never trims it by default, so on a long bulk run it grows without bound — it had
    // reached 858MB here. Nothing in this app consumes the stream (status comes from
    // getJob), so a short history is plenty.
    streams: { events: { maxLen: Number(process.env.PREVIEW_JOB_EVENTS_MAXLEN) || 1000 } },
  });

  if (process.env.PREVIEW_WORKER !== 'off') {
    const worker = new Worker(name, async (job) => processor(job.data), {
      connection: connectionOptions(),
      concurrency,
      lockDuration: LOCK_MS,
      // Don't sweep for stalled jobs faster than a lock can legitimately live, or the
      // check races long renders back onto the queue.
      stalledInterval: LOCK_MS,
      maxStalledCount: 1,
    });
    log.info(
      `[job-queue] ${name}: worker on, concurrency ${concurrency}, lock ${Math.round(LOCK_MS / 1000)}s`
    );
    worker.on('error', (e) => log.error('[preview-pdf worker] error:', e.message));
    worker.on('failed', (job, e) =>
      log.warn(`[preview-pdf worker] job ${job && job.id} failed:`, e && e.message)
    );
    // A stall means the lock expired mid-render: the job gets re-queued and rendered
    // again. Surface it loudly — it's the signature of PREVIEW_JOB_LOCK_MS being too low.
    worker.on('stalled', (jobId) =>
      log.warn(
        `[preview-pdf worker] job ${jobId} STALLED — lock (${Math.round(LOCK_MS / 1000)}s) ` +
          'expired mid-render; it will render again. Raise PREVIEW_JOB_LOCK_MS.'
      )
    );
  }

  async function getJob(id) {
    const job = await queue.getJob(id);
    if (!job) return null;
    const raw = await job.getState();
    const out = { id, state: STATE_MAP[raw] || raw };
    if (out.state === 'failed') out.error = job.failedReason || undefined;
    return out;
  }

  const DEFAULT_PRIORITY = 5; // lower = sooner (BullMQ: 1 highest)

  return {
    async enqueue(id, data, opts = {}) {
      const priority = opts.priority ?? DEFAULT_PRIORITY;
      // jobId = id: BullMQ ignores a duplicate add while a job with that id exists,
      // giving us the same content-key dedup as the in-process backend.
      const existing = await queue.getJob(id);
      if (existing) {
        // A failed job is kept for 24h (removeOnFail) for diagnostics, but it must not
        // poison its content key: without this, re-requesting a render that failed once
        // — transient sidecar timeout, restart mid-render — keeps reporting the old
        // failure for a day instead of retrying. Drop it and re-add below.
        //
        // Only retry a STALE failure. GET /api/preview/pdf re-enqueues on every cache
        // miss, so retrying a fresh failure makes a permanently-broken render loop
        // failed -> queued -> failed forever: the poller only ever sees queued/active
        // and never learns it is broken. Past the grace period, a retry is a genuine
        // new attempt rather than the same poll cycle spinning.
        try {
          const age = Date.now() - Number(existing.finishedOn || 0);
          if ((await existing.getState()) === 'failed' && age > RETRY_FAILED_AFTER_MS) {
            await existing.remove();
            log.info(`[job-queue] ${name}: retrying previously-failed job ${id}`);
            await queue.add(name, data, {
              jobId: id,
              priority,
              removeOnComplete: { age: 3600, count: 1000 },
              removeOnFail: { age: 24 * 3600, count: 1000 },
            });
            return getJob(id);
          }
        } catch {
          /* best effort — fall through to the normal dedup path */
        }
        // Bump a still-waiting job if this request is higher priority (interactive
        // over warm). changePriority is a no-op / best-effort once it's running.
        try {
          const state = await existing.getState();
          if (
            (state === 'waiting' || state === 'prioritized' || state === 'delayed') &&
            (existing.priority == null || priority < existing.priority)
          ) {
            await existing.changePriority({ priority });
          }
        } catch {
          /* best effort */
        }
        return getJob(id);
      }
      await queue.add(name, data, {
        jobId: id,
        priority,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600, count: 1000 },
      });
      return getJob(id);
    },
    getJob,
  };
}
