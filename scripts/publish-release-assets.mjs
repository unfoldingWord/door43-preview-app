#!/usr/bin/env node
// Generate a resource's release PDFs and attach them to its DCS release.
//
// The preview server already renders everything we need (per book x page size, plus a
// whole-resource PDF) and caches it; this script drives that, names each PDF the way
// DCS releases have always named them, and uploads it as a release attachment.
//
//   render matrix -> POST /api/preview/pdf (enqueue) -> poll -> GET (download)
//                 -> POST {dcs}/api/v1/repos/{owner}/{repo}/releases/{id}/assets
//
// Naming (verified against unfoldingWord/en_ult v89, all 54 books):
//   per book     en_ult_01-GEN_v90_A4.pdf   /  ..._LETTER.pdf
//                the "01-GEN" part is the catalog ingredient's `sort`, zero-padded,
//                plus the uppercased identifier — NOT a hardcoded canon order.
//   whole        en_ult_v90.pdf             US Letter, no page size in the name
//                (skipped for TSV Translation Notes — too large to compile whole)
//   TA / TW      en_ta_v90_A4.pdf / en_ta_v90_LETTER.pdf
//                whole-only, page size in the name (these ship no per-book PDFs)
//
// SAFE BY DEFAULT: renders and downloads only. Uploading to a real release is
// irreversible-ish and outward-facing, so it needs an explicit --publish plus a token.
// Assets already present on the release are skipped unless --replace is passed, which
// makes a re-run cheap and resumable.
//
// Usage:
//   node scripts/publish-release-assets.mjs --repo en_ult --ref v90 --list
//   node scripts/publish-release-assets.mjs --repo en_ult --ref v90            # render+download
//   DCS_WRITE_TOKEN=… node scripts/publish-release-assets.mjs --repo en_ult --ref v90 --publish
//
//   # the whole v90 batch:
//   node scripts/publish-release-assets.mjs --targets \
//     unfoldingWord/hbo_uhb@v3.0.0,unfoldingWord/en_tn@v90,unfoldingWord/en_tq@v90,\
//   unfoldingWord/en_ult@v90,unfoldingWord/en_ust@v90,unfoldingWord/en_ta@v90,unfoldingWord/en_tw@v90
//
// Options:
//   --targets <list>   comma-separated owner/repo@ref (repeatable alternative to --repo/--ref)
//   --owner <o>        default unfoldingWord
//   --repo <r> --ref <v>
//   --base <url>       preview server, default http://localhost:3000 (env PREVIEW_BASE_URL)
//   --dcs <url>        DCS origin, default https://git.door43.org (env DCS_HOST)
//   --token <t>        DCS write token (env DCS_WRITE_TOKEN); required with --publish
//   --out <dir>        download dir, default ./release-assets/<repo>_<ref>
//   --concurrency <n>  parallel download/upload lanes, default 4
//   --serial           strictly one PDF at a time: render it, upload it, then move on.
//                      Nothing is queued ahead, so peak memory is one render. Use when
//                      the sidecar is OOM-ing on heavy books (en_tn) — slower but safe.
//   --columns <n>      render N-column pages (default 1). The Bibles (UHB/ULT/UST) ship
//                      as 2-column. Part of the server's cache key, so 1- and 2-column
//                      renders coexist rather than invalidating each other.
//   --only <subs>      comma-separated substrings; keep only assets whose name matches
//                      (e.g. --only 08-RUT, or --only _A4 to do one paper size first)
//   --warm-only        render + verify every PDF into the server cache but keep no local
//                      copy. Use when disk is tight: the later --publish pass re-fetches
//                      from cache (fast) and deletes each file as it uploads.
//   --list             print the planned assets and exit (no rendering)
//   --publish          upload to the release (otherwise: render + download only)
//   --replace          re-upload assets that already exist on the release
//   --keep-files       keep downloaded PDFs after a successful upload
import { writeFile, readFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const NON_BOOK = new Set(['frt', 'bak', 'int']); // front/back/intro ingredients aren't books
const NO_WHOLE_SUBJECTS = new Set(['TSV Translation Notes']); // too huge to compile whole
// TSV-backed subjects: these need an explicit book list for a whole-resource render.
const TSV_SUBJECTS = new Set(['TSV Translation Questions', 'TSV Translation Notes']);
const WHOLE_ONLY_SUBJECTS = new Set(['Translation Academy', 'Translation Words']);
// label used in the filename -> the renderer's page size id
const PAGE_SIZES = { A4: 'A4_PORTRAIT', LETTER: 'US_LETTER_PORTRAIT' };
const WHOLE_PAGE_SIZE = 'US_LETTER_PORTRAIT'; // the bare-named whole file is US Letter

function parseArgs(argv) {
  const a = {
    owner: 'unfoldingWord',
    base: process.env.PREVIEW_BASE_URL || 'http://localhost:3000',
    dcs: process.env.DCS_HOST || 'https://git.door43.org',
    token: process.env.DCS_WRITE_TOKEN || '',
    concurrency: 4,
  };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const val = () => argv[++i];
    if (k === '--owner') a.owner = val();
    else if (k === '--repo') a.repo = val();
    else if (k === '--ref') a.ref = val();
    else if (k === '--targets') a.targets = val();
    else if (k === '--base') a.base = val();
    else if (k === '--dcs') a.dcs = val();
    else if (k === '--token') a.token = val();
    else if (k === '--out') a.out = val();
    else if (k === '--concurrency') a.concurrency = Number(val()) || 4;
    else if (k === '--only') a.only = val().split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === '--columns') a.columns = Number(val()) || 1;
    else if (k === '--list') a.list = true;
    else if (k === '--publish') a.publish = true;
    else if (k === '--warm-only') a.warmOnly = true;
    else if (k === '--serial') { a.serial = true; a.concurrency = 1; }
    else if (k === '--replace') a.replace = true;
    else if (k === '--keep-files') a.keepFiles = true;
    else throw new Error(`unknown option: ${k}`);
  }
  a.base = a.base.replace(/\/+$/, '');
  a.dcs = a.dcs.replace(/\/+$/, '');
  return a;
}

const enc = encodeURIComponent;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retries transient DCS failures. This is on the critical path for --replace (it does
// the DELETE before the re-upload), so an un-retried blip here can drop an asset.
async function dcsJson(dcs, pathname, { token, method = 'GET' } = {}) {
  const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    let r;
    try {
      r = await fetch(`${dcs}/api/v1${pathname}`, {
        method,
        headers: token ? { Authorization: `token ${token}` } : {},
        signal: AbortSignal.timeout(120000),
      });
    } catch (e) {
      lastErr = e;
      if (attempt === 4) throw new Error(`DCS ${method} ${pathname} failed after ${attempt} attempts: ${e.message}`);
      await sleep(4000 * attempt);
      continue;
    }
    if (r.ok) return r.status === 204 ? null : r.json();
    if (!RETRYABLE.has(r.status) || attempt === 4) {
      throw new Error(`DCS ${method} ${pathname} -> ${r.status} ${await r.text().catch(() => '')}`.slice(0, 300));
    }
    await sleep(4000 * attempt);
  }
  throw lastErr || new Error(`DCS ${method} ${pathname}: exhausted retries`);
}

// The asset list for a resource/ref, straight from its catalog entry.
async function buildTargets({ owner, repo, ref, dcs, columns = 1 }) {
  const entry = await dcsJson(dcs, `/catalog/entry/${enc(owner)}/${enc(repo)}/${enc(ref)}`);
  const subject = entry.subject || '';
  const books = (entry.ingredients || [])
    .filter((i) => i.identifier && !NON_BOOK.has(i.identifier))
    .map((i) => ({ id: i.identifier, sort: i.sort }));

  const targets = [];
  const push = (name, books_, pageSize) =>
    targets.push({ name, descriptor: { owner, repo, ref, books: books_, pageSize, columns } });

  if (WHOLE_ONLY_SUBJECTS.has(subject)) {
    // TA/TW ship one combined PDF per page size and no per-book files.
    for (const [label, pageSize] of Object.entries(PAGE_SIZES)) {
      push(`${repo}_${ref}_${label}.pdf`, [], pageSize);
    }
    // Plus an unsuffixed copy of the US Letter file: unfoldingword.org links to these
    // without a page size. Same descriptor as the LETTER entry, so it is a cache hit —
    // the identical bytes are simply attached under a second name, not re-rendered.
    push(`${repo}_${ref}.pdf`, [], WHOLE_PAGE_SIZE);
    return { subject, books, targets };
  }

  for (const b of books) {
    const code = `${String(b.sort).padStart(2, '0')}-${b.id.toUpperCase()}`;
    for (const [label, pageSize] of Object.entries(PAGE_SIZES)) {
      push(`${repo}_${code}_${ref}_${label}.pdf`, [b.id], pageSize);
    }
  }
  if (!NO_WHOLE_SUBJECTS.has(subject) && books.length > 1) {
    // "Whole" is normally an empty book list, which the renderer expands to every
    // ingredient — but only on the USFM path. The TSV fetcher iterates the requested
    // books with no such fallback, so an empty list yields zero books and it throws
    // "No valid books were processed from the TSV data". Name every book explicitly
    // for TSV subjects; the output is the same single combined PDF.
    const wholeBooks = TSV_SUBJECTS.has(subject) ? books.map((b) => b.id) : [];
    push(`${repo}_${ref}.pdf`, wholeBooks, WHOLE_PAGE_SIZE);
  }
  return { subject, books, targets };
}

// Descriptor -> the preview server's PDF query string. `server` is passed explicitly so
// the script works against any preview instance regardless of its own DCS_HOST.
function pdfQuery(d, dcs) {
  const q = new URLSearchParams({
    owner: d.owner,
    repo: d.repo,
    ref: d.ref,
    pageSize: d.pageSize,
    server: dcs,
  });
  // columns is part of the server's content cache key, so the GET must carry the same
  // value the POST enqueued — otherwise we wait on a 2-column render while polling the
  // 1-column key, and never see it complete.
  if (d.columns && d.columns !== 1) q.set('columns', String(d.columns));
  if (d.books.length) q.set('books', d.books.join(','));
  return q.toString();
}

// Enqueue the render (dedups on the content key; returns immediately if already cached).
async function enqueue(base, dcs, d) {
  const r = await fetch(`${base}/api/preview/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...d, books: d.books.join(','), server: dcs }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok && r.status !== 202) throw new Error(`enqueue -> ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json(); // { jobId, state }
}

// Poll until the render finishes, then download. A 404 from the job route just means the
// job record aged out — the GET below is the real source of truth (200 = cached bytes,
// 503 = still rendering, retry).
// Deadline covers queue wait + render, so it must exceed the server's own PDF timeout
// (PREVIEW_PDF_TIMEOUT_MS) with room for items sitting behind others in the queue.
async function fetchPdf(base, dcs, d, { timeoutMs = 120 * 60 * 1000 } = {}) {
  const url = `${base}/api/preview/pdf?${pdfQuery(d, dcs)}`;
  const deadline = Date.now() + timeoutMs;
  let lastState = '';
  // Transient HTTP statuses. 408 in particular is not the server rejecting the work:
  // this poll loop runs for hours over keep-alive connections, and a request sent onto
  // a socket the server is concurrently retiring comes back 408. Retry rather than
  // burning a finished render. Same for the usual proxy/backpressure codes.
  const RETRYABLE = new Set([408, 425, 429, 500, 502, 504]);
  let transient = 0;
  while (Date.now() < deadline) {
    let r;
    try {
      r = await fetch(url, { signal: AbortSignal.timeout(300000) });
    } catch (e) {
      // Socket hangups/aborts are the same class of problem as a 408.
      if (++transient > 10) throw new Error(`download failed after ${transient} network errors: ${e.message}`);
      await sleep(5000);
      continue;
    }
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    if (r.status === 503) {
      const body = await r.json().catch(() => ({}));
      if (body.state && body.state !== lastState) lastState = body.state;
      if (body.state === 'failed') throw new Error('render failed on the server');
      await sleep(10000);
      continue;
    }
    if (RETRYABLE.has(r.status)) {
      if (++transient > 10) throw new Error(`download -> ${r.status} after ${transient} retries`);
      await sleep(5000);
      continue;
    }
    throw new Error(`download -> ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  throw new Error(`timed out after ${Math.round(timeoutMs / 60000)}m (last state: ${lastState || 'unknown'})`);
}

async function uploadAsset({ dcs, token, owner, repo, releaseId, name, buf, existing, replace }) {
  const prior = existing.get(name);
  if (prior) {
    if (!replace) return 'skipped (already attached)';
    await dcsJson(dcs, `/repos/${enc(owner)}/${enc(repo)}/releases/${releaseId}/assets/${prior.id}`, {
      token,
      method: 'DELETE',
    });
  }
  // DCS occasionally answers a large upload with a gateway error (504) even though the
  // write may have landed, so retry — but re-check the release first. Blindly re-POSTing
  // would attach a second copy under the same name.
  const UPLOAD_RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
  const url = `${dcs}/api/v1/repos/${enc(owner)}/${enc(repo)}/releases/${releaseId}/assets?name=${enc(name)}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const fd = new FormData();
    fd.append('attachment', new Blob([buf], { type: 'application/pdf' }), name);
    let r;
    try {
      r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `token ${token}` },
        body: fd,
        signal: AbortSignal.timeout(600000),
      });
    } catch (e) {
      if (attempt === 5) throw new Error(`upload failed after ${attempt} attempts: ${e.message}`);
      await sleep(5000 * attempt);
      continue;
    }
    if (r.ok) return prior ? 'replaced' : 'uploaded';
    if (!UPLOAD_RETRYABLE.has(r.status) || attempt === 5) {
      throw new Error(`upload -> ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
    await sleep(5000 * attempt);
    // Did the failed attempt actually land? If so, stop before duplicating it.
    const rel = await dcsJson(dcs, `/repos/${enc(owner)}/${enc(repo)}/releases/${releaseId}`, { token }).catch(() => null);
    const landed = rel && (rel.assets || []).find((a) => a.name === name && a.size === buf.length);
    if (landed) return prior ? 'replaced' : 'uploaded';
  }
  throw new Error(`upload -> exhausted retries for ${name}`);
}

// Run fn over items with bounded concurrency.
async function mapLimit(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

const fmtMB = (n) => `${(n / 1024 / 1024).toFixed(1)}MB`;

async function runTarget({ owner, repo, ref, args }) {
  const { dcs, base } = args;
  const label = `${owner}/${repo}@${ref}`;
  const built = await buildTargets({ owner, repo, ref, dcs, columns: args.columns || 1 });
  const { subject, books } = built;
  const targets = args.only
    ? built.targets.filter((t) => args.only.some((s) => t.name.includes(s)))
    : built.targets;

  // The release must already exist — this script attaches to it, never creates it.
  const release = await dcsJson(dcs, `/repos/${enc(owner)}/${enc(repo)}/releases/tags/${enc(ref)}`);
  const existing = new Map((release.assets || []).map((a) => [a.name, a]));

  console.log(`\n=== ${label} — ${subject} — ${books.length} books ===`);
  console.log(`release id ${release.id}, ${existing.size} asset(s) already attached`);
  console.log(`${targets.length} asset(s) planned`);

  if (args.list) {
    for (const t of targets) {
      const mark = existing.has(t.name) ? 'HAVE' : ' -- ';
      console.log(`  [${mark}] ${t.name}  (books=${t.descriptor.books.join(',') || '_whole'} ${t.descriptor.pageSize})`);
    }
    return { label, planned: targets.length, done: 0, skipped: 0, failed: [] };
  }

  const todo = args.replace ? targets : targets.filter((t) => !existing.has(t.name));
  const skipped = targets.length - todo.length;
  if (skipped) console.log(`${skipped} already attached — skipping (use --replace to redo)`);
  if (!todo.length) return { label, planned: targets.length, done: 0, skipped, failed: [] };

  // Normally queue every render up front so the server's worker never idles between
  // items. --serial skips that: each PDF is requested only when its turn comes, so the
  // worker renders exactly the book being waited on and the queue never holds more than
  // one pending job. Slower, but it keeps peak memory to a single render and makes
  // progress strictly ordered — the mode to use when renders are OOM-ing.
  let cachedCount = 0;
  if (args.serial) {
    console.log(`serial mode: one render at a time, enqueued on demand`);
  } else {
    console.log(`enqueuing ${todo.length} render(s)…`);
    for (const t of todo) {
      try {
        const s = await enqueue(base, dcs, t.descriptor);
        if (s.state === 'completed') cachedCount++;
      } catch (e) {
        console.warn(`  ! enqueue ${t.name}: ${e.message}`);
      }
    }
    console.log(`${cachedCount}/${todo.length} already cached; ${todo.length - cachedCount} to render`);
  }

  const outDir = args.out || path.join('release-assets', `${repo}_${ref}`);
  if (!args.warmOnly) await mkdir(outDir, { recursive: true });

  const failed = [];
  let done = 0;
  await mapLimit(todo, args.concurrency, async (t) => {
    const file = path.join(outDir, t.name);
    try {
      let buf;
      let how = 'downloaded';
      if (existsSync(file) && !args.replace && !args.warmOnly) {
        buf = await readFile(file); // resume: reuse a PDF an earlier run already pulled
      } else {
        buf = await fetchPdf(base, dcs, t.descriptor);
        // Cheap sanity check — a truncated or error body must not pass as an asset.
        if (buf.length < 1024 || buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
          throw new Error(`not a valid PDF (${buf.length} bytes)`);
        }
        if (args.warmOnly) how = 'rendered (cached, not kept)';
        else await writeFile(file, buf);
      }
      if (args.publish && !args.warmOnly) {
        how = await uploadAsset({
          dcs, token: args.token, owner, repo, releaseId: release.id,
          name: t.name, buf, existing, replace: args.replace,
        });
        if (!args.keepFiles && how !== 'skipped (already attached)') await unlink(file).catch(() => {});
      }
      done++;
      console.log(`  [${done + skipped}/${targets.length}] ${t.name} ${fmtMB(buf.length)} — ${how}`);
    } catch (e) {
      failed.push({ name: t.name, error: e.message });
      console.error(`  ! ${t.name}: ${e.message}`);
    }
  });

  return { label, planned: targets.length, done, skipped, failed };
}

async function main() {
  const args = parseArgs(process.argv);

  const targets = [];
  if (args.targets) {
    for (const spec of args.targets.split(',').map((s) => s.trim()).filter(Boolean)) {
      const m = /^([^/]+)\/([^@]+)@(.+)$/.exec(spec);
      if (!m) throw new Error(`bad --targets entry (want owner/repo@ref): ${spec}`);
      targets.push({ owner: m[1], repo: m[2], ref: m[3] });
    }
  } else {
    if (!args.repo || !args.ref) throw new Error('need --repo and --ref (or --targets owner/repo@ref,…)');
    targets.push({ owner: args.owner, repo: args.repo, ref: args.ref });
  }

  if (args.publish && !args.token) {
    throw new Error('--publish needs a DCS write token (--token or DCS_WRITE_TOKEN)');
  }
  if (!args.list) {
    console.log(`preview server: ${args.base}`);
    console.log(`DCS:            ${args.dcs}`);
    const mode = args.warmOnly
      ? 'render + verify into the cache (no local copies, no upload)'
      : args.publish
        ? 'RENDER + UPLOAD to releases'
        : 'render + download only (no upload)';
    console.log(`mode:           ${mode}`);
  }

  const results = [];
  for (const t of targets) results.push(await runTarget({ ...t, args }));

  console.log('\n===== summary =====');
  let anyFailed = false;
  for (const r of results) {
    const f = r.failed.length;
    if (f) anyFailed = true;
    console.log(`${r.label}: ${r.done} done, ${r.skipped} skipped, ${f} failed (of ${r.planned} planned)`);
    for (const x of r.failed.slice(0, 10)) console.log(`   ! ${x.name}: ${x.error}`);
  }
  if (anyFailed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`\nfatal: ${e.message}`);
  process.exitCode = 1;
});
