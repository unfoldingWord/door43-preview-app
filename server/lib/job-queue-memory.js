// In-process job-queue backend: dev / single instance, no external infra.
// Same async surface as the BullMQ backend: enqueue(id, data) / getJob(id).
// Jobs do NOT survive a restart and run in this process only — production uses
// the Redis backend.
export function createMemoryQueue({ processor, concurrency = 2, retainMs = 10 * 60 * 1000 }) {
  const jobs = new Map(); // id -> { state, data, startedAt, error }
  const waiting = []; // queued ids, FIFO
  let active = 0;

  const durations = []; // rolling completed-render durations, for a rough ETA
  const DUR_WINDOW = 20;
  const avgMs = () =>
    durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 10000;

  function statusOf(id) {
    const j = jobs.get(id);
    if (!j) return null;
    const out = { id, state: j.state };
    if (j.state === 'queued') {
      const pos = waiting.indexOf(id);
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
      const id = waiting.shift();
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
    async enqueue(id, data) {
      const ex = jobs.get(id);
      if (ex && (ex.state === 'queued' || ex.state === 'active')) return statusOf(id); // dedup
      jobs.set(id, { state: 'queued', data });
      waiting.push(id);
      pump();
      return statusOf(id);
    },
    async getJob(id) {
      return statusOf(id);
    },
  };
}
