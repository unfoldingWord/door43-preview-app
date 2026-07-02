// In-process job-queue backend: dev / single instance, no external infra.
// Same async surface as the BullMQ backend: enqueue(id, data, opts?) / getJob(id).
// Jobs do NOT survive a restart and run in this process only — production uses
// the Redis backend.
//
// Priority: enqueue(id, data, { priority }) — lower number runs sooner (default 5).
// Interactive PDF requests use a low number so they jump ahead of warm/cron jobs;
// re-enqueuing a still-waiting job at a higher priority bumps it up the queue.
export function createMemoryQueue({ processor, concurrency = 2, retainMs = 10 * 60 * 1000 }) {
  const DEFAULT_PRIORITY = 5;
  const jobs = new Map(); // id -> { state, data, priority, startedAt, error }
  const waiting = []; // [{ id, priority }], kept in ascending priority (lower = sooner)
  let active = 0;

  const durations = []; // rolling completed-render durations, for a rough ETA
  const DUR_WINDOW = 20;
  const avgMs = () =>
    durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 10000;

  // Insert keeping ascending priority, FIFO within equal priority.
  function insertWaiting(id, priority) {
    let i = waiting.length;
    for (let k = 0; k < waiting.length; k++) {
      if (waiting[k].priority > priority) {
        i = k;
        break;
      }
    }
    waiting.splice(i, 0, { id, priority });
  }

  function statusOf(id) {
    const j = jobs.get(id);
    if (!j) return null;
    const out = { id, state: j.state };
    if (j.state === 'queued') {
      const pos = waiting.findIndex((w) => w.id === id);
      out.queuePosition = pos < 0 ? undefined : pos + 1;
      const ahead = Math.max(0, pos);
      out.etaSeconds = Math.round((avgMs() * (Math.floor(ahead / concurrency) + 1)) / 1000);
    } else if (j.state === 'active') {
      out.etaSeconds = Math.round(avgMs() / 1000);
    } else if (j.state === 'failed') {
      out.error = j.error;
    }
    return out;
  }

  function retire(id) {
    const t = setTimeout(() => jobs.delete(id), retainMs);
    if (t.unref) t.unref();
  }

  function pump() {
    while (active < concurrency && waiting.length) {
      const { id } = waiting.shift();
      const j = jobs.get(id);
      if (!j || j.state !== 'queued') continue;
      active += 1;
      j.state = 'active';
      j.startedAt = Date.now();
      Promise.resolve()
        .then(() => processor(j.data))
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

  return {
    async enqueue(id, data, opts = {}) {
      const priority = opts.priority ?? DEFAULT_PRIORITY;
      const ex = jobs.get(id);
      if (ex && (ex.state === 'queued' || ex.state === 'active')) {
        // Dedup — but if this request is higher priority, bump a still-waiting job up.
        if (ex.state === 'queued' && priority < ex.priority) {
          ex.priority = priority;
          const i = waiting.findIndex((w) => w.id === id);
          if (i >= 0) waiting.splice(i, 1);
          insertWaiting(id, priority);
        }
        return statusOf(id);
      }
      jobs.set(id, { state: 'queued', data, priority });
      insertWaiting(id, priority);
      pump();
      return statusOf(id);
    },
    async getJob(id) {
      return statusOf(id);
    },
  };
}
