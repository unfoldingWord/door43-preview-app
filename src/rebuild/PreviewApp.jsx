// PreviewApp — the rebuilt, thin client. It renders nothing itself: it points an
// isolated <iframe> at the server routes (/api/preview/html, /api/preview/pdf),
// which render via @unfoldingword/door43-preview-renderers. No proskomma/usfm-js
// in the browser — the app is catalog browsing, navigation, and job orchestration.
//
// Flow: search the catalog -> pick a resource -> pick a book -> view; navigate to
// a chapter/verse (scrolls the iframe to the <abbr>-<book>-<chap>[-<verse>] anchor)
// or switch books; and render a PDF via the async job queue.
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
  Autocomplete,
  LinearProgress,
  CircularProgress,
  Alert,
  Stack,
  ThemeProvider,
  createTheme,
  CssBaseline,
} from '@mui/material';

// unfoldingWord brand palette
const theme = createTheme({
  palette: {
    primary: { main: '#31ADE3' }, // Inspire
    secondary: { main: '#70C9CC' }, // Cultivate
    text: { primary: '#231F20' }, // Tech
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

export default function PreviewApp() {
  const [lang, setLang] = useState('en');
  const [subject, setSubject] = useState('Aligned Bible');
  const [searching, setSearching] = useState(false);
  const [entries, setEntries] = useState([]);
  const [entry, setEntry] = useState(null); // selected catalog entry
  const [book, setBook] = useState(''); // selected book ingredient id
  const [nav, setNav] = useState(null); // { chapters: [{ id, anchor, verses:[{id,anchor}] }] }
  const [navLoading, setNavLoading] = useState(false);
  const [chapterOpt, setChapterOpt] = useState(null);
  const [verseOpt, setVerseOpt] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfJob, setPdfJob] = useState(null);
  const [error, setError] = useState(null);
  const iframeRef = useRef(null);
  const pollRef = useRef(null);

  const bookBased = !!(entry && entry.books && entry.books.length > 1);

  const stopPoll = () => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  };

  const search = async (l = lang, s = subject) => {
    stopPoll();
    setSearching(true);
    setError(null);
    setEntries([]);
    setEntry(null);
    setBook('');
    setPreviewUrl('');
    setPdfJob(null);
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

  // Populate the picker on first load with the defaults.
  useEffect(() => {
    search('en', 'Aligned Bible');
    return stopPoll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const htmlUrl = (e, b) => {
    const qs = new URLSearchParams({ owner: e.owner, repo: e.repo, ref: e.ref, media: 'web' });
    if (b) qs.set('books', b);
    return `/api/preview/html?${qs.toString()}`;
  };

  const renderView = (e, b) => {
    if (!e) return;
    stopPoll();
    setPdfJob(null);
    setError(null);
    setLoading(true);
    setPreviewUrl(htmlUrl(e, b));
    if (b) fetchNav(e, b);
    else {
      setNav(null);
      setChapterOpt(null);
      setVerseOpt(null);
    }
  };

  const pickEntry = (e) => {
    setEntry(e);
    setChapterOpt(null);
    setVerseOpt(null);
    setNav(null);
    if (!e) {
      setBook('');
      setPreviewUrl('');
      return;
    }
    const books = e.books || [];
    let b = '';
    if (books.length > 1) {
      const firstBook = books.find((x) => !NON_BOOK_INGREDIENTS.has(x.id)) || books[0];
      b = firstBook ? firstBook.id : '';
    }
    setBook(b);
    renderView(e, b);
  };

  const changeBook = (b) => {
    setBook(b);
    setChapterOpt(null);
    setVerseOpt(null);
    renderView(entry, b);
  };

  // Chapter/verse lists come from the actual rendered content (only what exists).
  const fetchNav = async (e, b) => {
    setNav(null);
    setChapterOpt(null);
    setVerseOpt(null);
    setNavLoading(true);
    try {
      const qs = new URLSearchParams({ owner: e.owner, repo: e.repo, ref: e.ref, book: b });
      const r = await fetch(`/api/preview/nav?${qs.toString()}`);
      const data = await r.json();
      if (r.ok) setNav(data);
    } catch {
      /* nav is best-effort; the view still works without it */
    } finally {
      setNavLoading(false);
    }
  };

  // Scroll the same-origin iframe to an anchor without reloading.
  const scrollToAnchor = (anchor) => {
    if (!anchor) return;
    const win = iframeRef.current && iframeRef.current.contentWindow;
    try {
      // Toggle so the browser re-scrolls even if the hash is unchanged.
      win.location.hash = '';
      win.location.hash = `#${anchor}`;
    } catch {
      // Cross-origin fallback: reload the doc at the anchor.
      setLoading(true);
      setPreviewUrl(`${htmlUrl(entry, book)}#${anchor}`);
    }
  };

  const runPdf = async () => {
    if (!entry) return;
    stopPoll();
    setError(null);
    setPreviewUrl('');
    const descriptor = { owner: entry.owner, repo: entry.repo, ref: entry.ref, pageSize: 'A4_PORTRAIT' };
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

  const resourceLabel = (e) =>
    e ? `${e.title} — ${e.owner}/${e.repo}@${e.ref}` : '';

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
              <TextField
                label="Language"
                size="small"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                sx={{ width: 120 }}
              />
              <FormControl size="small" sx={{ minWidth: 200 }}>
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
                sx={{ flexGrow: 1, minWidth: 280 }}
                size="small"
                options={entries}
                value={entry}
                onChange={(e, v) => pickEntry(v)}
                getOptionLabel={resourceLabel}
                isOptionEqualToValue={(a, b) => a.owner === b.owner && a.repo === b.repo && a.ref === b.ref}
                renderInput={(params) => (
                  <TextField {...params} label={`Resource (${entries.length})`} placeholder="Select a resource…" />
                )}
              />
            </Stack>

            {/* Row 2: book + navigation (book-based resources) */}
            {entry && (
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                {bookBased && (
                  <>
                    <FormControl size="small" sx={{ minWidth: 220 }}>
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
                      onChange={(e, c) => {
                        setChapterOpt(c);
                        setVerseOpt(null);
                        if (c) scrollToAnchor(c.anchor);
                      }}
                      renderInput={(p) => (
                        <TextField {...p} label="Chapter" placeholder={navLoading ? 'loading…' : 'ch'} />
                      )}
                    />
                    <Autocomplete
                      size="small"
                      sx={{ width: 140 }}
                      options={(chapterOpt && chapterOpt.verses) || []}
                      value={verseOpt}
                      disabled={!chapterOpt}
                      getOptionLabel={(v) => (v ? String(v.id) : '')}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      onChange={(e, v) => {
                        setVerseOpt(v);
                        if (v) scrollToAnchor(v.anchor);
                      }}
                      renderInput={(p) => <TextField {...p} label="Verse" placeholder="v" />}
                    />
                  </>
                )}
                <Box sx={{ flexGrow: 1 }} />
                <Button variant="outlined" onClick={() => renderView(entry, book)}>
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
                Pick a <strong>Subject</strong> and language, click <strong>Find</strong>, then choose a
                resource. For a Bible, pick a book and jump to a chapter/verse.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </ThemeProvider>
  );
}
