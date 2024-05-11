// React imports
import { useEffect, useState, useContext } from 'react';

// Material UI imports
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material';

// Context imports
import { AppContext } from '@components/App.context';

// Custom hooks imports
import useGetOBSData from '../hooks/useGetOBSData';
import useGenerateOpenBibleStoriesHtml from '../hooks/useGenerateOpenBibleStoriesHtml';
import useFetchZipFileData from '@hooks/useFetchZipFileData';

// Other imports
import { useBibleReference } from 'bible-reference-rcl';
import BibleReference from 'bible-reference-rcl';

const webCss = `
article img {
  display: block;
  margin: 0 auto;
  width: 100%;
  max-width: 640px;
}
`;

const printCss = `
.obs-story-title {
  text-align: center;
}

#pagedjs-print .obs-story-title {
  break-after: page !important;
  padding-top: 300px;
}

article {
  break-before: auto;
  break-after: auto;
}

section {
  break-before: page;
  break-after: page;
}
`;

const theme = createTheme({
  overrides: {
    MuiInput: {
      '*': {
        borderBottom: '2px solid red',
      },
    },
  },
});

export default function OpenBibleStories() {
  const {
    state: { catalogEntry, urlInfo, navAnchor, authToken },
    actions: { setStatusMessage, setErrorMessage, setHtmlSections, setNavAnchor, setBuiltWith },
  } = useContext(AppContext);

  const [imageResolution, setImageResolution] = useState('360px');

  const onBibleReferenceChange = (b, c, v) => {
    setNavAnchor(`${b}-${c}-${v}`);
  };

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: 'obs',
    initialChapter: urlInfo.hashParts[1] || '1',
    initialVerse: urlInfo.hashParts[2] || '1',
    onChange: onBibleReferenceChange,
    addOBS: true,
  });

  const zipFileData = useFetchZipFileData({ catalogEntry, authToken });

  const obsData = useGetOBSData({ catalogEntry, zipFileData, setErrorMessage });

  const obsHtmlSections = useGenerateOpenBibleStoriesHtml({ obsData, setErrorMessage, resolution: imageResolution });

  useEffect(() => {
    setStatusMessage(
      <>
        Preparing OBS Preview.
        <br />
        Please wait...
      </>
    );
    bibleReferenceActions.applyBooksFilter(['obs']);
  }, [setStatusMessage]);

  useEffect(() => {
    if (catalogEntry) {
      setBuiltWith([catalogEntry])
    }
  }, [catalogEntry, setBuiltWith])

  useEffect(() => {
    if (navAnchor && navAnchor.split('-').length >= 2) {
      const parts = navAnchor.split('-');
      if (parts[0] == 'obs' && (bibleReferenceState.chapter != parts[1] || bibleReferenceState.verse != (parts[2] || '1'))) {
        bibleReferenceActions.goToBookChapterVerse(parts[0], parts[1], parts[2] || '1');
      }
    }
  }, [navAnchor]);

  useEffect(() => {
    // Handle Print Preview & Status & Navigation
    if (obsHtmlSections) {
      setHtmlSections((prevState) => {
        return { ...prevState, ...obsHtmlSections };
      });
      setHtmlSections((prevState) => {return {...prevState, css: {web: webCss, print: printCss}}});
      setStatusMessage('');
    }
  }, [obsHtmlSections, setHtmlSections, setStatusMessage]);

  return (
    <ThemeProvider theme={theme}>
      <BibleReference status={bibleReferenceState} actions={bibleReferenceActions} style={{ minWidth: 'auto' }} />
      <FormControl>
        <InputLabel id="image-resolution-label">Images</InputLabel>
        <Select labelId="image-resolution-label" label="Images" value={imageResolution} onChange={(event) => setImageResolution(event.target.value)}>
          <MenuItem value="none">Hide Images</MenuItem>
          <MenuItem value="360px">640x360px</MenuItem>
          <MenuItem value="2160px">3840x2160px</MenuItem>
        </Select>
      </FormControl>
    </ThemeProvider>
  );
}
