// React imports
import { useState, useEffect, useContext } from 'react';

// Material UI imports
import { ThemeProvider, createTheme } from '@mui/material';

// Custom hooks
import useUsfmPreviewRenderer from '@hooks/useUsfmPreviewRenderer';
import useFetchZipFileData from '@hooks/useFetchZipFileData';

// Bible reference imports
import BibleReference from 'bible-reference-rcl';
import { useBibleReference } from 'bible-reference-rcl';

// Helper functions
import { getLtrPreviewStyle, getRtlPreviewStyle } from '@helpers/previewStyling.js';
import { ts2usfm } from '@helpers/ts2usfm';

// Context
import { AppContext } from '@components/App.context';

// Data
import { BibleBookData } from '@common/books';
import { generateCopyrightAndLicenseHTML } from '@helpers/html';

const theme = createTheme({
  overrides: {
    MuiInput: {
      outline: {
        '&:hover:not(.Mui-disabled):before': {
          borderBottom: '2px solid white',
        },
        '&:before': {
          borderBottom: '1px solid white',
        },
        '&:after': {
          borderBottom: '2px solid white',
        },
      },
    },
  },
});

const webCss = `
h1 {
  column-span: all;
}

.new-page {
  break-after: page;
  column-span: all;
}

.header-link {
  text-decoration: none;
  color: inherit;
}
`;

export default function TsBible() {
  const {
    state: { urlInfo, catalogEntry, expandedBooks, bookTitle, supportedBooks, navAnchor, builtWith, authToken, renderNewCopy },
    actions: { setBookTitle, setBuiltWith, setSupportedBooks, setStatusMessage, setErrorMessage, setHtmlSections, setNavAnchor, setCanChangeColumns },
  } = useContext(AppContext);

  const [myBookId, setMyBookId] = useState('')
  const [usfmText, setUsfmText] = useState();
  const [copyright, setCopyright] = useState('');

  const renderFlags = {
    showWordAtts: false,
    showTitles: true,
    showHeadings: true,
    showIntroductions: true,
    showFootnotes: true,
    showXrefs: false,
    showParaStyles: true,
    showCharacterMarkup: false,
    showChapterLabels: true,
    showVersesLabels: true,
  };

  const onBibleReferenceChange = (b, c, v) => {
    if (b && ! expandedBooks.includes(b)) {
      const url = new URL(window.location);
      url.hash = '';
      url.searchParams.delete('book');
      url.searchParams.set('book', b);
      window.history.replaceState(null, '', url);
      window.location.reload();
    } else if (setNavAnchor) {
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
    initialBook: myBookId || catalogEntry?.ingredients?.[0]?.identifier || 'gen',
    initialChapter: parseInt(urlInfo.hashParts[1]) || 1,
    initialVerse: parseInt(urlInfo.hashParts[2]) || 1,
    onChange: onBibleReferenceChange,
  });

  const zipFileData = useFetchZipFileData({
    catalogEntry,
    canFetch: renderNewCopy,
  });

  const { renderedData, htmlReady } = useUsfmPreviewRenderer({
    bookId: myBookId,
    usfmText,
    renderFlags,
    renderStyles: catalogEntry?.language_direction === 'rtl' ? getRtlPreviewStyle() : getLtrPreviewStyle(),
    htmlRender: true,
  });

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
    const setInitialBookIdAndSupportedBooks = async () => {
      let sb = catalogEntry.ingredients?.filter((ingredient) => BibleBookData[ingredient.identifier]).map((ingredient) => ingredient.identifier) || [];

      if (!sb.length) {
        setErrorMessage('No books found for this tS project');
      }

      let _bookId = sb[0];
      if (expandedBooks.length && sb.includes(expandedBooks[0])) {
        _bookId = expandedBooks[0];
      }

      const title = catalogEntry.ingredients.filter((ingredient) => ingredient.identifier == _bookId).map((ingredient) => ingredient.title)[0] || _bookId;
      setBookTitle(title);
      setMyBookId(_bookId);
      setStatusMessage(
        <>
          Preparing preview for {title}.
          <br />
          Please wait...
        </>
      );
      setSupportedBooks(sb);
      bibleReferenceActions.applyBooksFilter(sb);
      setCanChangeColumns(true);
    };

    if (catalogEntry) {
      setInitialBookIdAndSupportedBooks();
    }
  }, [expandedBooks, urlInfo, catalogEntry, setCanChangeColumns, setErrorMessage, setSupportedBooks, setStatusMessage, setBookTitle]);

  useEffect(() => {
    const getUsfmFromZipFileData = async () => {
      if (!(myBookId in BibleBookData)) {
        setErrorMessage(`Invalid book: ${myBookId}`);
        return;
      }

      const ingredient = catalogEntry.ingredients.filter((ingredient) => ingredient.identifier == myBookId)?.[0];
      const _usfmText = await ts2usfm(catalogEntry, ingredient, zipFileData);
      setUsfmText(_usfmText);
    };

    if (catalogEntry && zipFileData && myBookId && supportedBooks.includes(myBookId)) {
      getUsfmFromZipFileData();
    }
  }, [catalogEntry, myBookId, supportedBooks, zipFileData, setErrorMessage]);

  useEffect(() => {
    const generateCopyrightPage = async () => {
      const copyrightAndLicense = await generateCopyrightAndLicenseHTML(
        catalogEntry,
        builtWith,
        authToken,
      );
      setCopyright(copyrightAndLicense);
    };

    if (catalogEntry && builtWith.length && renderNewCopy) {
      generateCopyrightPage();
    }
  }, [catalogEntry, builtWith, authToken, renderNewCopy, setCopyright]);

  useEffect(() => {
    const handleRenderedDataFromUsfmToHtmlHook = async () => {
      let _html = renderedData.replaceAll(
        /<span id="chapter-(\d+)-verse-(\d+)"([^>]*)>(\d+)<\/span>/g,
        `<span id="nav-${myBookId}-$1-$2"$3><a href="#nav-${myBookId}-$1-$2" class="header-link">$4</a></span>`
      );
      _html = _html.replaceAll(
        /<span id="chapter-(\d+)"([^>]+)>([\d]+)<\/span>/gi,
        `<span id="nav-${myBookId}-$1" data-toc-title="${bookTitle} $1"$2><a href="#nav-${myBookId}-$1-1" class="header-link">$3</a></span>`
      );
      _html = _html.replace(/<span([^>]+style="[^">]+#CCC[^">]+")/gi, `<span$1 class="footnote"`);
      _html = `<div class="section bible-book" id="nav-${myBookId}" data-toc-title="${bookTitle}">${_html}</div>`;
      setHtmlSections((prevState) => {
        return {
          ...prevState,
          cover: `<h3 class="cover-book-title">${bookTitle}</h3>`,
          copyright,
          body: _html,
        }
      });
      setStatusMessage('');
      setHtmlSections((prevState) => {return {...prevState, css: {web: webCss}}});
    };

    if (htmlReady && renderedData && copyright && myBookId) {
      handleRenderedDataFromUsfmToHtmlHook();
    }
  }, [myBookId, htmlReady, renderedData, copyright, bookTitle, setHtmlSections, setStatusMessage, setErrorMessage]);

  return (
    <ThemeProvider theme={theme}>
      <BibleReference status={bibleReferenceState} actions={bibleReferenceActions} />
    </ThemeProvider>
  );
}
