// React imports
import { useEffect, useState, useContext } from 'react';

// Material UI imports
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material';

// Context imports
import { AppContext } from '@components/App.context';

// Custom hooks imports
import useGetOBSData from '@hooks/useGetOBSData';
import useGenerateOpenBibleStoriesHtml from '@hooks/useGenerateOpenBibleStoriesHtml';
import useFetchZipFileData from '@hooks/useFetchZipFileData';

// Other imports
import { useBibleReference } from 'bible-reference-rcl';
import BibleReference from 'bible-reference-rcl';

const webCss = `
.article img {
  display: block;
  margin: 0 auto;
  width: 100%;
  max-width: 640px;
}

a.header-link {
  font-weight: inherit !important;
  font-size: inherit !important;
  color: #000000;
  text-decoration: none;
}

a.header-link:hover::after {
  content: '#';
  padding-left: 5px;
  color: blue;
  display: inline-block;
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

.article {
  break-before: auto !important;
  break-after: auto !important;
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
    state: { catalogEntry, urlInfo, navAnchor, renderOptions },
    actions: { setStatusMessage, setErrorMessage, setHtmlSections, setNavAnchor, setBuiltWith, setSupportedBooks, setCanChangeColumns },
  } = useContext(AppContext);

  const [imageResolution, setImageResolution] = useState('360px');
  const [copyright, setCopyright] = useState('');

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

  const zipFileData = useFetchZipFileData({ catalogEntry });

  const obsData = useGetOBSData({ catalogEntry, zipFileData });

  const html = useGenerateOpenBibleStoriesHtml({ obsData, resolution: imageResolution, chapters: renderOptions.chapters });

  useEffect(() => {
    const sb = ['obs'];
    bibleReferenceActions.applyBooksFilter(sb);
    setSupportedBooks(sb);
    setHtmlSections((prevState) => {
      return { ...prevState, css: { web: webCss, print: printCss } };
    });
    setCanChangeColumns(false);

    if (!catalogEntry) {
      // setErrorMessage('No catalog entry for this resource found.');
      return;
    }

    setStatusMessage(
      <>
        Preparing preview for {catalogEntry.title}.
        <br />
        Please wait...
      </>
    );
  }, [catalogEntry, setCanChangeColumns, setErrorMessage, setHtmlSections, setStatusMessage, setSupportedBooks]);

  useEffect(() => {
    if (catalogEntry) {
      setBuiltWith([catalogEntry])
    }
  }, [catalogEntry, setBuiltWith])

  useEffect(() => {
    if (navAnchor && ! navAnchor.includes('--')) {
      const parts = navAnchor.split('-');
      if (bibleReferenceState.bookId == parts[0] && (bibleReferenceState.chapter != (parts[1] || '1') || bibleReferenceState.verse != (parts[2] || '1'))) {
        bibleReferenceActions.goToBookChapterVerse(parts[0], parts[1] || '1', parts[2] || '1');
      }
    }
  }, [navAnchor]);

  useEffect(() => {
    const generateCopyrightPage = async () => {
      const copyrightAndLicense = `
<div class="obs-front-matter">
  ${obsData.front}
</div>
`;
      setCopyright(copyrightAndLicense);
    };

    if (catalogEntry && obsData) {
      generateCopyrightPage();
    }
  }, [catalogEntry, obsData, setCopyright]);

  useEffect(() => {
    // Handle Print Preview & Status & Navigation
    if (html && copyright) {
      setHtmlSections((prevState) => {
        return { ...prevState,
          cover: (renderOptions.chaptersOrigStr ? `<h3>Stories: ${renderOptions.chaptersOrigStr}</h3>` : ''),
          copyright,
          body: html
        };
      });
      setStatusMessage('');
    }
  }, [html, copyright, setHtmlSections, setStatusMessage]);

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
