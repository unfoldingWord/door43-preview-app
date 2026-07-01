// Async job queue — pluggable backend, selected by environment:
//   REDIS_URL or REDIS_HOST set -> BullMQ/Redis (production: persistent,
//                                  multi-worker, survives restarts)
//   otherwise                   -> in-process (dev / single instance, no infra)
//
// Both backends expose the same async surface:
//   enqueue(id, data) -> status      (dedup: id should be the content cache key)
//   getJob(id)        -> status | null
// where status = { id, state: 'queued'|'active'|'completed'|'failed',
//                  queuePosition?, etaSeconds?, error? }
//
// The unit of work is a serializable `data` payload plus a `processor(data)`
// function registered once here — NOT a closure — so the same job can be run by
// a separate BullMQ worker process/container.
import { createMemoryQueue } from './job-queue-memory.js';
import { createRedisQueue } from './job-queue-bullmq.js';

export function createJobQueue(opts) {
  const useRedis = !!(process.env.REDIS_URL || process.env.REDIS_HOST);
  console.log(
    `[job-queue] ${opts.name}: ${useRedis ? 'BullMQ/Redis' : 'in-process'} backend`
  );
  return useRedis ? createRedisQueue(opts) : createMemoryQueue(opts);
}
