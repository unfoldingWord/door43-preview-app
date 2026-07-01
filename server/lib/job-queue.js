// Async job queue for PDF renders.
//
// PLUGGABLE BY DESIGN. This is the in-process backend: good for dev and a single
// server, needs no external infra. Production swaps in BullMQ/Redis behind the
// same enqueue()/getJob() surface so jobs persist, run across worker containers,
// and survive restarts. Keep this module's API stable when you add that backend.
//
// Dedup: the job id is caller-supplied (we pass the content cache key), so
// identical in-flight requests coalesce onto a single job.

const jobs = new Map(); // id -> { state, runner, createdAt, startedAt, finishedAt, error }
const waiting = []; // queued job ids, FIFO
let active = 0;

const CONCURRENCY = Number(process.env.PREVIEW_JOB_CONCURRENCY) || 2;
const RETAIN_MS = Number(process.env.PREVIEW_JOB_RETAIN_MS) || 10 * 60 * 1000;

// Rolling window of completed render durations, for a rough ETA.
const durations = [];
const DUR_WINDOW = 20;
function avgDurationMs() {
  if (!durations.length) return 10000; // initial guess before we have data
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

export function getJob(id) {
  const j = jobs.get(id);
  if (!j) return null;
  const out = { id, state: j.state };
  if (j.state === 'queued') {
    const pos = waiting.indexOf(id); // 0-based
    out.queuePosition = pos < 0 ? undefined : pos + 1;
    const ahead = Math.max(0, pos);
    out.etaSeconds = Math.round((avgDurationMs() * (Math.floor(ahead / CONCURRENCY) + 1)) / 1000);
  } else if (j.state === 'active') {
    out.etaSeconds = Math.round(avgDurationMs() / 1000);
  } else if (j.state === 'failed') {
    out.error = j.error;
  }
  return out;
}

export function enqueue(id, runner) {
  const existing = jobs.get(id);
  if (existing && (existing.state === 'queued' || existing.state === 'active')) {
    return getJob(id); // dedup onto the in-flight job
  }
  jobs.set(id, { state: 'queued', runner, createdAt: Date.now() });
  waiting.push(id);
  pump();
  return getJob(id);
}

function retire(id) {
  const j = jobs.get(id);
  if (!j) return;
  j.finishedAt = Date.now();
  // Keep the terminal state around so clients can read it, then evict.
  setTimeout(() => jobs.delete(id), RETAIN_MS).unref?.();
}

function pump() {
  while (active < CONCURRENCY && waiting.length) {
    const id = waiting.shift();
    const j = jobs.get(id);
    if (!j || j.state !== 'queued') continue;
    active += 1;
    j.state = 'active';
    j.startedAt = Date.now();
    Promise.resolve()
      .then(() => j.runner())
      .then(() => {
        j.state = 'completed';
        durations.push(Date.now() - j.startedAt);
        if (durations.length > DUR_WINDOW) durations.shift();
        retire(id);
      })
      .catch((e) => {
        j.state = 'failed';
        j.error = e && e.message ? e.message : String(e);
        retire(id);
      })
      .finally(() => {
        active -= 1;
        pump();
      });
  }
}
