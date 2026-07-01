// BullMQ/Redis job-queue backend: production. Jobs persist in Redis, survive
// restarts, and can be processed by multiple worker containers. Same async
// surface as the in-process backend: enqueue(id, data) / getJob(id).
//
// Connection: REDIS_URL (redis://[user:pass@]host:port[/db]) or REDIS_HOST/PORT,
// plus REDIS_DB to pin a dedicated DB index (isolate from other Redis users such
// as DCS). The in-process worker runs here unless PREVIEW_WORKER=off, so a
// dedicated worker container can own processing instead.
import { Queue, Worker } from 'bullmq';

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

export function createRedisQueue({ name, processor, concurrency = 2 }) {
  const queue = new Queue(name, { connection: connectionOptions() });

  if (process.env.PREVIEW_WORKER !== 'off') {
    const worker = new Worker(name, async (job) => processor(job.data), {
      connection: connectionOptions(),
      concurrency,
    });
    worker.on('error', (e) => console.error('[preview-pdf worker] error:', e.message));
    worker.on('failed', (job, e) =>
      console.error(`[preview-pdf worker] job ${job && job.id} failed:`, e && e.message)
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

  return {
    async enqueue(id, data) {
      // jobId = id: BullMQ ignores a duplicate add while a job with that id exists,
      // giving us the same content-key dedup as the in-process backend.
      await queue.add(name, data, {
        jobId: id,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600, count: 1000 },
      });
      return getJob(id);
    },
    getJob,
  };
}
