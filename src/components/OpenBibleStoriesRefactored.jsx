// React imports
import { useEffect, useState, useContext } from 'react';

// Material UI imports
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material';

// Context imports
import { AppContext } from '@components/App.context';

// Bible reference imports
import { useBibleReference } from 'bible-reference-rcl';
import BibleReference from 'bible-reference-rcl';

// Renderer import - THE MAGIC! 🎉
import { generateOpenBibleStoriesHtml } from '../renderers/obsRenderer.js';

const theme = createTheme({
  overrides: {
    MuiInput: {
      '*': {
        borderBottom: '2px solid red',
      },
    },
  },
});

/**
 * Simplified OpenBibleStories Component
 * 
 * This component is now ~80 lines instead of 200+ lines!
 * All the complex logic is in the standalone renderer.
 */
export default function OpenBibleStories() {
  const {
    state: { catalogEntry, urlInfo, navAnchor, renderOptions, authToken },
    actions: {
      setStatusMessage,
      setErrorMessage,
      setHtmlSections,
      setNavAnchor,
      setBuiltWith,
      setSupportedBooks,
      setCanChangeColumns,
    },
  } = useContext(AppContext);

  const [imageResolution, setImageResolution] = useState('360px');
  const [renderState, setRenderState] = useState({
    html: null,
    copyright: '',
    error: null,
    progress: { message: '', percent: 0 },
  });

  const onBibleReferenceChange = (b, c, v) => {
    if (setNavAnchor) {
      let anchorParts = [b];
      if (c != '1' || v != '1') {
        anchorParts.push(c);
      }
      if (v != '1') {
        anchorParts.push(v);
      }
      setNavAnchor(anchorParts.join('-'));
    }
  };

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: 'obs',
    initialChapter: parseInt(urlInfo.hashParts[1]) || 1,
    initialVerse: parseInt(urlInfo.hashParts[2]) || 1,
    onChange: onBibleReferenceChange,
    addOBS: true,
  });

  // Initialize
  useEffect(() => {
    const sb = ['obs'];
    bibleReferenceActions.applyBooksFilter(sb);
    setSupportedBooks(sb);
    setCanChangeColumns(false);

    if (!catalogEntry) {
      return;
    }

    setStatusMessage(
      <>
        Preparing preview for {catalogEntry.title}.
        <br />
        Please wait...
      </>
    );
  }, [catalogEntry, setCanChangeColumns, setStatusMessage, setSupportedBooks]);

  useEffect(() => {
    if (catalogEntry) {
      setBuiltWith([catalogEntry]);
    }
  }, [catalogEntry, setBuiltWith]);

  // Main rendering effect - THIS IS WHERE THE MAGIC HAPPENS! ✨
  useEffect(() => {
    if (!catalogEntry) {
      return;
    }

    const generateHtml = async () => {
      try {
        setRenderState((prev) => ({
          ...prev,
          progress: { message: 'Starting...', percent: 0 },
        }));

        const result = await generateOpenBibleStoriesHtml({
          owner: urlInfo.owner,
          repo: urlInfo.repo,
          ref: catalogEntry.branch_or_tag_name,
          catalogEntry,
          authToken,
          resolution: imageResolution,
          chapters: renderOptions?.chapters,
          onProgress: (message, percent) => {
            setRenderState((prev) => ({
              ...prev,
              progress: { message, percent },
            }));
            setStatusMessage(
              <>
                {message}
                <br />
                {percent}% complete
              </>
            );
          },
        });

        // Generate copyright page
        const copyright = `
<div class="obs-front-matter">
  ${result.obsData.front}
</div>
`;

        // Success! Update state
        setRenderState({
          html: result.html,
          copyright,
          error: null,
          progress: { message: 'Complete!', percent: 100 },
        });

        setHtmlSections({
          css: result.css,
          cover: renderOptions.chaptersOrigStr
            ? `<h3>Stories: ${renderOptions.chaptersOrigStr}</h3>`
            : '',
          copyright,
          body: result.html,
        });

        setStatusMessage('');
      } catch (error) {
        console.error('Error generating OBS:', error);
        setRenderState({
          html: null,
          copyright: '',
          error,
          progress: { message: 'Error', percent: 0 },
        });
        setErrorMessage(error.message || 'Failed to generate Open Bible Stories');
      }
    };

    generateHtml();
  }, [catalogEntry, imageResolution, renderOptions, authToken, urlInfo]);

  // Handle navigation
  useEffect(() => {
    if (navAnchor && !navAnchor.includes('--')) {
      const parts = navAnchor.split('-');
      if (
        bibleReferenceState.bookId == parts[0] &&
        (bibleReferenceState.chapter != (parts[1] || '1') ||
          bibleReferenceState.verse != (parts[2] || '1'))
      ) {
        bibleReferenceActions.goToBookChapterVerse(parts[0], parts[1] || '1', parts[2] || '1');
      }
    }
  }, [navAnchor]);

  return (
    <ThemeProvider theme={theme}>
      <BibleReference
        status={bibleReferenceState}
        actions={bibleReferenceActions}
        style={{ minWidth: 'auto' }}
      />
      <FormControl>
        <InputLabel id="image-resolution-label">Images</InputLabel>
        <Select
          labelId="image-resolution-label"
          label="Images"
          value={imageResolution}
          onChange={(event) => setImageResolution(event.target.value)}
        >
          <MenuItem value="none">Hide Images</MenuItem>
          <MenuItem value="360px">640x360px</MenuItem>
          <MenuItem value="2160px">3840x2160px</MenuItem>
        </Select>
      </FormControl>
    </ThemeProvider>
  );
}
