// PreviewApp — the rebuilt, thin client. It renders NOTHING itself: it points an
// isolated <iframe> at the server route (/api/preview/html), which renders the
// resource via @unfoldingword/door43-preview-renderers. No proskomma / usfm-js /
// RCL rendering in the browser — the app is UI + navigation only.
//
// First slice: Open Bible Stories (story/frame based, no book/chapter/verse
// selector needed). A catalog-driven selector and the PDF job come next.
import { useState, useRef } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  TextField,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
  CircularProgress,
  Alert,
  Stack,
  Chip,
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

const PRESETS = [
  { label: 'OBS (en)', owner: 'unfoldingWord', repo: 'en_obs', ref: 'master' },
];

export default function PreviewApp() {
  const [owner, setOwner] = useState('unfoldingWord');
  const [repo, setRepo] = useState('en_obs');
  const [ref, setRef] = useState('master');
  const [media, setMedia] = useState('web');
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfJob, setPdfJob] = useState(null); // async PDF job status
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const canPreview = owner.trim() && repo.trim();

  const stopPoll = () => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
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
    if (j.state === 'active') {
      return `Rendering PDF${j.etaSeconds ? ` · ~${j.etaSeconds}s` : ''}…`;
    }
    return `${j.state}…`;
  };

  const runPreview = () => {
    if (!canPreview) return;
    const qs = new URLSearchParams({
      owner: owner.trim(),
      repo: repo.trim(),
      ref: ref.trim() || 'master',
      media,
    });
    setLoading(true);
    setPreviewUrl(`/api/preview/html?${qs.toString()}`);
  };

  // PDF is an async job: enqueue -> poll status -> serve the cached PDF when done.
  // Rendered by the WeasyPrint sidecar server-side; the queue handles concurrency
  // and heavy renders without holding the request open.
  const runPdf = async () => {
    if (!canPreview) return;
    stopPoll();
    setError(null);
    setPreviewUrl('');
    const descriptor = {
      owner: owner.trim(),
      repo: repo.trim(),
      ref: ref.trim() || 'master',
      pageSize: 'A4_PORTRAIT',
    };
    const serveUrl = `/api/preview/pdf?${new URLSearchParams(descriptor).toString()}`;
    const showPdf = () => {
      setPdfJob(null);
      setLoading(true);
      setPreviewUrl(serveUrl); // cache HIT now that the job populated it
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
          if (sr.status === 404) return showPdf(); // job evicted -> serve from cache
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

  const applyPreset = (p) => {
    setOwner(p.owner);
    setRepo(p.repo);
    setRef(p.ref);
  };

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

        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            runPreview();
          }}
          sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: 'background.paper' }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ md: 'center' }}
          >
            <TextField
              label="Owner"
              size="small"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
            <TextField
              label="Repo"
              size="small"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
            <TextField
              label="Ref"
              size="small"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              sx={{ width: 120 }}
            />
            <ToggleButtonGroup
              size="small"
              exclusive
              value={media}
              onChange={(e, v) => v && setMedia(v)}
            >
              <ToggleButton value="web">Web</ToggleButton>
              <ToggleButton value="print">Print</ToggleButton>
            </ToggleButtonGroup>
            <Button type="submit" variant="contained" disabled={!canPreview}>
              Preview
            </Button>
            <Button type="button" variant="outlined" onClick={runPdf} disabled={!canPreview}>
              PDF
            </Button>
            <Stack direction="row" spacing={1}>
              {PRESETS.map((p) => (
                <Chip
                  key={p.label}
                  label={p.label}
                  onClick={() => applyPreset(p)}
                  variant="outlined"
                  size="small"
                />
              ))}
            </Stack>
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
              title="preview"
              src={previewUrl}
              onLoad={() => setLoading(false)}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          ) : (
            <Box sx={{ p: 4, color: 'text.secondary' }}>
              <Typography>
                Choose a resource and click <strong>Preview</strong>. Try the{' '}
                <em>OBS (en)</em> preset.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </ThemeProvider>
  );
}
