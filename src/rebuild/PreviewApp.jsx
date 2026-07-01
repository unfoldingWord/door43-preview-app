// PreviewApp — the rebuilt, thin client. It renders nothing itself: it points an
// isolated <iframe> at the server routes (/api/preview/html, /api/preview/pdf),
// which render via @unfoldingword/door43-preview-renderers.
//
// Flow: search the catalog (latest releases) -> pick a resource -> (optionally) a
// version (branch / older release) -> a book -> view; navigate to a chapter/verse
// or switch books; render a PDF via the async job queue. Deep-linkable:
//   /u/<owner>/<repo>/<ref>?book=<book>&ref=<ch>:<vs>   (also chapter=&verse=)
// No <ref> in the path -> latest release.
import { useState, useRef, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  TextField,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  ListSubheader,
  Autocomplete,
  Checkbox,
  FormControlLabel,
  Chip,
  LinearProgress,
  CircularProgress,
  Alert,
  Stack,
  ThemeProvider,
  createTheme,
  CssBaseline,
} from '@mui/material';

const theme = createTheme({
  palette: {
    primary: { main: '#31ADE3' },
    secondary: { main: '#70C9CC' },
    text: { primary: '#231F20' },
    background: { default: '#f5f7f9', paper: '#ffffff' },
  },
  shape: { borderRadius: 8 },
});

const SUBJECTS = [
  'Aligned Bible',
  'Bible',
  'Open Bible Stories',
  'TSV Translation Notes',
  'TSV Translation Questions',
  'Translation Words',
  'Translation Academy',
];
const NON_BOOK_INGREDIENTS = new Set(['frt', 'bak', 'int']);

// --- URL helpers (hot-link routing) ---
function parseRoute() {
  const m = window.location.pathname.match(/^\/u\/([^/]+)\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!m) return null;
  const q = new URLSearchParams(window.location.search);
  let chapter = q.get('chapter') || '';
  let verse = q.get('verse') || '';
  const scriptureRef = q.get('ref'); // e.g. "4:2" (query ref = scripture, path = version)
  if (scriptureRef && !chapter) {
    const [c, v] = scriptureRef.split(':');
    chapter = c || '';
    verse = v || '';
  }
  return {
    owner: decodeURIComponent(m[1]),
    repo: decodeURIComponent(m[2]),
    version: m[3] ? decodeURIComponent(m[3]) : '',
    book: q.get('book') || '',
    chapter,
    verse,
  };
}

function urlFor({ owner, repo, version, book, chapter, verse }) {
  let path = `/u/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  if (version) path += `/${encodeURIComponent(version)}`;
  const q = new URLSearchParams();
  if (book) q.set('book', book);
  if (chapter) q.set('ref', verse ? `${chapter}:${verse}` : String(chapter));
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}

export default function PreviewApp() {
  const [lang, setLang] = useState('en');
  const [subject, setSubject] = useState('Aligned Bible');
  const [searching, setSearching] = useState(false);
  const [entries, setEntries] = useState([]);
  const [entry, setEntry] = useState(null);

  const [showDevVersions, setShowDevVersions] = useState(false);
  const [versions, setVersions] = useState(null); // { latestRelease, releases[], branches[] }
  const [version, setVersion] = useState('');

  const [book, setBook] = useState('');
  const [nav, setNav] = useState(null);
  const [navLoading, setNavLoading] = useState(false);
  const [chapterOpt, setChapterOpt] = useState(null);
  const [verseOpt, setVerseOpt] = useState(null);

  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfJob, setPdfJob] = useState(null);
  const [error, setError] = useState(null);
  const [pendingScroll, setPendingScroll] = useState(null); // {chapter, verse} to scroll after load

  const iframeRef = useRef(null);
  const pollRef = useRef(null);

  const bookBased = !!(entry && entry.books && entry.books.length > 1);

  const stopPoll = () => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  };

  const defaultBook = (e) => {
    const books = (e && e.books) || [];
    if (books.length <= 1) return '';
    return (books.find((b) => !NON_BOOK_INGREDIENTS.has(b.id)) || books[0]).id;
  };

  const pushUrl = (parts) => {
    try {
      window.history.pushState({}, '', urlFor(parts));
    } catch {
      /* ignore */
    }
  };

  // ---- data fetches ----
  const search = async (l = lang, s = subject) => {
    stopPoll();
    setSearching(true);
    setError(null);
    setEntries([]);
    setEntry(null);
    setBook('');
    setPreviewUrl('');
    setPdfJob(null);
    setVersions(null);
    try {
      const qs = new URLSearchParams({ lang: (l || 'en').trim(), subject: s });
      const r = await fetch(`/api/catalog/search?${qs.toString()}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `catalog search failed (${r.status})`);
      setEntries(data.entries || []);
      if (!data.entries || !data.entries.length) setError('No resources found for that language + subject.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  };

  const fetchVersions = async (owner, repo) => {
    setVersions(null);
    try {
      const r = await fetch(`/api/catalog/versions?${new URLSearchParams({ owner, repo })}`);
      const data = await r.json();
      if (r.ok) setVersions(data);
    } catch {
      /* versions are best-effort */
    }
  };

  const fetchNav = async (owner, repo, ver, b) => {
    setNav(null);
    setChapterOpt(null);
    setVerseOpt(null);
    setNavLoading(true);
    try {
      const qs = new URLSearchParams({ owner, repo, ref: ver || '', book: b });
      const r = await fetch(`/api/preview/nav?${qs.toString()}`);
      const data = await r.json();
      if (r.ok) setNav(data);
    } catch {
      /* nav best-effort */
    } finally {
      setNavLoading(false);
    }
  };

  // ---- rendering ----
  const htmlUrl = (owner, repo, ver, b) => {
    const qs = new URLSearchParams({ owner, repo, media: 'web' });
    if (ver) qs.set('ref', ver);
    if (b) qs.set('books', b);
    return `/api/preview/html?${qs.toString()}`;
  };

  const renderView = (e, ver, b) => {
    if (!e) return;
    stopPoll();
    setPdfJob(null);
    setError(null);
    setLoading(true);
    setPreviewUrl(htmlUrl(e.owner, e.repo, ver, b));
    if (b) fetchNav(e.owner, e.repo, ver, b);
    else {
      setNav(null);
      setChapterOpt(null);
      setVerseOpt(null);
    }
  };

  const scrollToAnchor = (anchor) => {
    if (!anchor) return;
    const win = iframeRef.current && iframeRef.current.contentWindow;
    try {
      win.location.hash = '';
      win.location.hash = `#${anchor}`;
    } catch {
      setLoading(true);
      setPreviewUrl(`${htmlUrl(entry.owner, entry.repo, version, book)}#${anchor}`);
    }
  };

  // ---- selection handlers (also sync the URL) ----
  const pickEntry = (e) => {
    setEntry(e);
    setChapterOpt(null);
    setVerseOpt(null);
    setNav(null);
    if (!e) {
      setBook('');
      setVersion('');
      setPreviewUrl('');
      return;
    }
    const ver = e.ref; // search returns latest-release entries
    const b = defaultBook(e);
    setVersion(ver);
    setBook(b);
    fetchVersions(e.owner, e.repo);
    renderView(e, ver, b);
    pushUrl({ owner: e.owner, repo: e.repo, version: ver, book: b });
  };

  const changeVersion = (v) => {
    setVersion(v);
    setChapterOpt(null);
    setVerseOpt(null);
    renderView(entry, v, book);
    pushUrl({ owner: entry.owner, repo: entry.repo, version: v, book });
  };

  const changeBook = (b) => {
    setBook(b);
    setChapterOpt(null);
    setVerseOpt(null);
    renderView(entry, version, b);
    pushUrl({ owner: entry.owner, repo: entry.repo, version, book: b });
  };

  const goChapter = (c) => {
    setChapterOpt(c);
    setVerseOpt(null);
    if (c) {
      scrollToAnchor(c.anchor);
      pushUrl({ owner: entry.owner, repo: entry.repo, version, book, chapter: c.id });
    }
  };

  const goVerse = (v) => {
    setVerseOpt(v);
    if (v) {
      scrollToAnchor(v.anchor);
      pushUrl({ owner: entry.owner, repo: entry.repo, version, book, chapter: chapterOpt.id, verse: v.id });
    }
  };

  // ---- direct (hot-link) load ----
  const directLoad = async (route) => {
    stopPoll();
    setError(null);
    setPdfJob(null);
    try {
      const qs = new URLSearchParams({ owner: route.owner, repo: route.repo });
      if (route.version) qs.set('ref', route.version);
      const r = await fetch(`/api/catalog/entry?${qs.toString()}`);
      const e = await r.json();
      if (!r.ok) throw new Error(e.error || `resource not found: ${route.owner}/${route.repo}`);
      setEntries((prev) => (prev.some((x) => x.owner === e.owner && x.repo === e.repo) ? prev : [e, ...prev]));
      setEntry(e);
      setVersion(e.ref);
      fetchVersions(e.owner, e.repo);
      const b = route.book || defaultBook(e);
      setBook(b);
      setPendingScroll(route.chapter ? { chapter: route.chapter, verse: route.verse } : null);
      renderView(e, e.ref, b);
    } catch (err) {
      setError(err.message);
    }
  };

  // ---- mount: route or default search; back/forward re-loads ----
  useEffect(() => {
    const load = () => {
      const route = parseRoute();
      if (route) directLoad(route);
      else search('en', 'Aligned Bible');
    };
    load();
    window.addEventListener('popstate', load);
    return () => {
      window.removeEventListener('popstate', load);
      stopPoll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- scroll to a deep-linked chapter/verse once nav + iframe are ready ----
  useEffect(() => {
    if (!pendingScroll || !nav || loading) return;
    const ch = (nav.chapters || []).find((c) => String(c.id) === String(pendingScroll.chapter));
    if (ch) {
      setChapterOpt(ch);
      let target = ch;
      if (pendingScroll.verse) {
        const v = (ch.verses || []).find((x) => String(x.id) === String(pendingScroll.verse));
        if (v) {
          setVerseOpt(v);
          target = v;
        }
      }
      scrollToAnchor(target.anchor);
    }
    setPendingScroll(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScroll, nav, loading]);

  // ---- PDF (async job) ----
  const runPdf = async () => {
    if (!entry) return;
    stopPoll();
    setError(null);
    setPreviewUrl('');
    const descriptor = { owner: entry.owner, repo: entry.repo, ref: version, pageSize: 'A4_PORTRAIT' };
    if (book) descriptor.books = book;
    const serveUrl = `/api/preview/pdf?${new URLSearchParams(descriptor).toString()}`;
    const showPdf = () => {
      setPdfJob(null);
      setLoading(true);
      setPreviewUrl(serveUrl);
    };
    setPdfJob({ state: 'starting' });
    try {
      const r = await fetch('/api/preview/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(descriptor),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `enqueue failed (${r.status})`);
      if (data.state === 'completed') return showPdf();
      const jobId = data.jobId;
      setPdfJob(data);
      const poll = async () => {
        try {
          const sr = await fetch(`/api/preview/pdf/${jobId}`);
          if (sr.status === 404) return showPdf();
          const s = await sr.json();
          if (s.state === 'completed') return showPdf();
          if (s.state === 'failed') {
            setPdfJob(null);
            setError(s.error || 'PDF render failed.');
            return;
          }
          setPdfJob(s);
          pollRef.current = setTimeout(poll, 1500);
        } catch (e) {
          setPdfJob(null);
          setError(e.message);
        }
      };
      pollRef.current = setTimeout(poll, 1200);
    } catch (e) {
      setPdfJob(null);
      setError(e.message);
    }
  };

  const jobLabel = (j) => {
    if (!j) return '';
    if (j.state === 'starting') return 'Submitting…';
    if (j.state === 'queued') {
      const pos = j.queuePosition ? ` (position ${j.queuePosition})` : '';
      const eta = j.etaSeconds ? ` · ~${j.etaSeconds}s` : '';
      return `Queued${pos}${eta}…`;
    }
    if (j.state === 'active') return `Rendering PDF${j.etaSeconds ? ` · ~${j.etaSeconds}s` : ''}…`;
    return `${j.state}…`;
  };

  const resourceLabel = (e) => (e ? `${e.title} — ${e.owner}/${e.repo}` : '');
  const isLatest = versions && version === versions.latestRelease;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppBar position="static" elevation={0} sx={{ bgcolor: '#31ADE3', color: '#ffffff' }}>
          <Toolbar variant="dense">
            <Typography variant="h6" sx={{ fontWeight: 700, mr: 2, color: '#ffffff' }}>
              Door43 Preview
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
              rebuild · server-rendered
            </Typography>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: 'background.paper' }}>
          <Stack spacing={1.5}>
            {/* Row 1: find resources */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
              <TextField label="Language" size="small" value={lang} onChange={(e) => setLang(e.target.value)} sx={{ width: 110 }} />
              <FormControl size="small" sx={{ minWidth: 190 }}>
                <InputLabel>Subject</InputLabel>
                <Select label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
                  {SUBJECTS.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="contained" onClick={() => search()} disabled={searching}>
                {searching ? 'Searching…' : 'Find'}
              </Button>
              <Autocomplete
                sx={{ flexGrow: 1, minWidth: 260 }}
                size="small"
                options={entries}
                value={entry}
                onChange={(e, v) => pickEntry(v)}
                getOptionLabel={resourceLabel}
                isOptionEqualToValue={(a, b) => a.owner === b.owner && a.repo === b.repo}
                renderInput={(params) => (
                  <TextField {...params} label={`Resource (${entries.length})`} placeholder="Select a resource…" />
                )}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={showDevVersions} onChange={(e) => setShowDevVersions(e.target.checked)} />}
                label="Branches & older versions"
              />
            </Stack>

            {/* Row 2: version + book + navigation */}
            {entry && (
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                {showDevVersions ? (
                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel>Version</InputLabel>
                    <Select label="Version" value={version} onChange={(e) => changeVersion(e.target.value)}>
                      {versions && !versions.releases.some((r) => r.tag === version) && !versions.branches.includes(version) && (
                        <MenuItem value={version}>{version}</MenuItem>
                      )}
                      <ListSubheader>Releases</ListSubheader>
                      {(versions?.releases || []).map((r) => (
                        <MenuItem key={r.tag} value={r.tag}>
                          {r.tag}
                          {r.tag === versions.latestRelease ? ' (latest)' : ''}
                          {r.prerelease ? ' — pre' : ''}
                        </MenuItem>
                      ))}
                      <ListSubheader>Branches</ListSubheader>
                      {(versions?.branches || []).map((b) => (
                        <MenuItem key={b} value={b}>
                          {b}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <Chip variant="outlined" color={isLatest ? 'primary' : 'default'} label={`${version}${isLatest ? ' · latest release' : ''}`} />
                )}

                {bookBased && (
                  <>
                    <FormControl size="small" sx={{ minWidth: 210 }}>
                      <InputLabel>Book</InputLabel>
                      <Select label="Book" value={book} onChange={(e) => changeBook(e.target.value)}>
                        {entry.books.map((b) => (
                          <MenuItem key={b.id} value={b.id}>
                            {b.title || b.id} ({b.id})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Autocomplete
                      size="small"
                      sx={{ width: 150 }}
                      options={(nav && nav.chapters) || []}
                      value={chapterOpt}
                      loading={navLoading}
                      getOptionLabel={(c) => (c ? String(c.id) : '')}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      onChange={(e, c) => goChapter(c)}
                      renderInput={(p) => <TextField {...p} label="Chapter" placeholder={navLoading ? 'loading…' : 'ch'} />}
                    />
                    <Autocomplete
                      size="small"
                      sx={{ width: 140 }}
                      options={(chapterOpt && chapterOpt.verses) || []}
                      value={verseOpt}
                      disabled={!chapterOpt}
                      getOptionLabel={(v) => (v ? String(v.id) : '')}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      onChange={(e, v) => goVerse(v)}
                      renderInput={(p) => <TextField {...p} label="Verse" placeholder="v" />}
                    />
                  </>
                )}
                <Box sx={{ flexGrow: 1 }} />
                <Button variant="outlined" onClick={() => renderView(entry, version, book)}>
                  Web
                </Button>
                <Button type="button" variant="contained" onClick={runPdf}>
                  PDF
                </Button>
              </Stack>
            )}
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 0 }}>
            {error}
          </Alert>
        )}

        {pdfJob && (
          <Box sx={{ px: 2, py: 1, bgcolor: '#eaf6fc', borderBottom: '1px solid #d0e8f5' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="body2" sx={{ color: '#014263' }}>
                {jobLabel(pdfJob)}
              </Typography>
            </Stack>
          </Box>
        )}

        {loading && <LinearProgress />}

        <Box sx={{ flexGrow: 1, position: 'relative', bgcolor: '#fafafa' }}>
          {previewUrl ? (
            <iframe
              ref={iframeRef}
              title="preview"
              src={previewUrl}
              onLoad={() => setLoading(false)}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          ) : (
            <Box sx={{ p: 4, color: 'text.secondary' }}>
              <Typography>
                Pick a <strong>Subject</strong> and language, click <strong>Find</strong>, then choose a resource. For a
                Bible, pick a book and jump to a chapter/verse. Check <em>Branches &amp; older versions</em> to preview
                work-in-progress.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </ThemeProvider>
  );
}
