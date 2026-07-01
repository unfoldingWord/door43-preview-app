// PreviewApp — the rebuilt, thin client. It renders NOTHING itself: it points an
// isolated <iframe> at the server route (/api/preview/html), which renders the
// resource via @unfoldingword/door43-preview-renderers. No proskomma / usfm-js /
// RCL rendering in the browser — the app is UI + navigation only.
//
// First slice: Open Bible Stories (story/frame based, no book/chapter/verse
// selector needed). A catalog-driven selector and the PDF job come next.
import { useState } from 'react';
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

  const canPreview = owner.trim() && repo.trim();

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

  const applyPreset = (p) => {
    setOwner(p.owner);
    setRepo(p.repo);
    setRef(p.ref);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppBar position="static" sx={{ bgcolor: '#014263' }}>
          <Toolbar variant="dense">
            <Typography variant="h6" sx={{ fontWeight: 700, mr: 2 }}>
              Door43 Preview
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
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
