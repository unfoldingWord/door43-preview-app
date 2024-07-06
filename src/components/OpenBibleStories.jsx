// React imports
import { useEffect, useContext } from 'react';

// Material UI imports
import { createTheme } from '@mui/material';

// Context imports
import { AppContext } from '@contexts/App.context';

// Custom hooks imports
import useGetOBSData from '@hooks/useGetOBSData';
import useGenerateOpenBibleStoriesHtml from '@hooks/useGenerateOpenBibleStoriesHtml';
import useFetchZipFileData from '@hooks/useFetchZipFileData';

// Other imports
import { useBibleReference } from 'bible-reference-rcl';
import BibleReference from 'bible-reference-rcl';
import { generateCoverPage, generateTocHtml } from '@helpers/html';
import ImageResolutionSelector from './ImageResolutionSelector';

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

.section {
  break-before: page !important;
  break-after: page !important;
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

const DEFAULT_IMAGE_RESOLUTION = '360px';

export default function OpenBibleStories() {
  const {
    state: { catalogEntry, urlInfo, navAnchor, authToken, builtWith, renderOptions },
    actions: { setStatusMessage, setErrorMessage, setHtmlSections, setNavAnchor, setBuiltWith, setSupportedBooks, setBookId, setCanChangeColumns, setRenderOptions, setOptionComponents, setNavComponent, },
  } = useContext(AppContext);

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
    initialChapter: urlInfo.hashParts[1] || '1',
    initialVerse: urlInfo.hashParts[2] || '1',
    onChange: onBibleReferenceChange,
    addOBS: true,
  });

  const zipFileData = useFetchZipFileData({ catalogEntry, authToken });

  const obsData = useGetOBSData({ catalogEntry, zipFileData, setErrorMessage });

  const html = useGenerateOpenBibleStoriesHtml({ obsData, setErrorMessage, resolution: renderOptions?.imageResolution || DEFAULT_IMAGE_RESOLUTION, chapters: renderOptions.chapters });

  useEffect(() => {
    const sb = ['obs'];
    bibleReferenceActions.applyBooksFilter(sb);
    setSupportedBooks(sb);
    setBookId('obs');
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

    setNavComponent(<BibleReference status={bibleReferenceState} actions={bibleReferenceActions} style={{ minWidth: 'auto' }} />);
    setOptionComponents(<ImageResolutionSelector formLabelTitle={"Image Resolution"} value={renderOptions?.imageResolution || DEFAULT_IMAGE_RESOLUTION} setImageResolution={(value) => setRenderOptions((prevState) => {return {...prevState, imageResolution: value}})} />)
  }, [catalogEntry, setCanChangeColumns, setErrorMessage, setBookId, setStatusMessage, setSupportedBooks, setOptionComponents, setRenderOptions]);

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
    const populateHtmlSections = async () => {
      const cover = generateCoverPage(catalogEntry, (renderOptions.chaptersOrigStr ? `<h3>Stories: ${renderOptions.chaptersOrigStr}</h3>` : ''));
      const copyright = `
<div class="obs-front-matter">
  ${obsData.front}
</div>
`;
      const toc = generateTocHtml(html);
      const body = html;

      setHtmlSections((prevState) => ({
        ...prevState,
        css: {
          web: webCss,
          print: printCss,
        },
        toc,
        cover,
        copyright,
        body,
      }));
      setStatusMessage('');
    };

    if (html && builtWith?.length) {
      populateHtmlSections();
    }

  }, [html, renderOptions, obsData, authToken, builtWith, catalogEntry, setHtmlSections, setStatusMessage]);
}
