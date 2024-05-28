// React imports
import { useState, useEffect, useContext } from 'react';

// Material UI imports
import { ThemeProvider, createTheme } from '@mui/material';

// Custom hooks
import useUsfmPreviewRenderer from '@hooks/useUsfmPreviewRender';
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
    state: { urlInfo, catalogEntry, bookId, bookTitle, supportedBooks, navAnchor, builtWith, authToken },
    actions: { setBookId, setBookTitle, setBuiltWith, setSupportedBooks, setStatusMessage, setErrorMessage, setHtmlSections, setNavAnchor, setCanChangeColumns },
  } = useContext(AppContext);

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
    if (b != (bookId || urlInfo.hashParts[0] || 'gen')) {
      window.location.hash = b;
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
    initialBook: bookId || urlInfo.hashParts[0] || 'gen',
    initialChapter: urlInfo.hashParts[1] || '1',
    initialVerse: urlInfo.hashParts[2] || '1',
    onChange: onBibleReferenceChange,
  });

  const zipFileData = useFetchZipFileData({
    authToken,
    catalogEntry,
    setErrorMessage,
  });

  const { renderedData, ready: htmlReady } = useUsfmPreviewRenderer({
    bookId,
    usfmText,
    renderFlags,
    renderStyles: catalogEntry?.language_direction === 'rtl' ? getRtlPreviewStyle() : getLtrPreviewStyle(),
    htmlRender: true,
    setErrorMessage,
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
      if (!catalogEntry) {
        // setErrorMessage('No catalog entry for this resource found.');
        return;
      }

      let sb = catalogEntry.ingredients?.map((ingredient) => ingredient.identifier) || [];

      if (!sb.length) {
        setErrorMessage('No books found for this tS project');
      }

      let _bookId = urlInfo.hashParts[0] || sb[0];
      if (!_bookId) {
        setErrorMessage('Unable to determine a book ID to render.');
        return;
      }
      const title = catalogEntry.ingredients.filter((ingredient) => ingredient.identifier == _bookId).map((ingredient) => ingredient.title)[0] || _bookId;
      setBookId(_bookId);
      setBookTitle(title);
      setStatusMessage(
        <>
          Preparing preview for {title}.
          <br />
          Please wait...
        </>
      );
      if (!sb.includes(_bookId)) {
        setErrorMessage(`This resource does not support the rendering of the book \`${_bookId}\`. Please choose another book to render.`);
        sb = [_bookId, ...sb];
      }

      setSupportedBooks(sb);
      bibleReferenceActions.applyBooksFilter(sb);

      setCanChangeColumns(true);
    };

    if (!bookId) {
      setInitialBookIdAndSupportedBooks();
    }
  }, [bookId, urlInfo, catalogEntry, setCanChangeColumns, setErrorMessage, setSupportedBooks, setBookId, setStatusMessage, setBookTitle]);

  useEffect(() => {
    const getUsfmFromZipFileData = async () => {
      if (!(bookId in BibleBookData)) {
        setErrorMessage(`Invalid book: ${bookId}`);
        return;
      }

      const ingredient = catalogEntry.ingredients.filter((ingredient) => ingredient.identifier == bookId)?.[0];
      const _usfmText = await ts2usfm(catalogEntry, ingredient, zipFileData);
      setUsfmText(_usfmText);
    };

    if (catalogEntry && zipFileData && bookId && supportedBooks.includes(bookId)) {
      getUsfmFromZipFileData();
    }
  }, [catalogEntry, bookId, supportedBooks, zipFileData, setErrorMessage]);

  useEffect(() => {
    const generateCopyrightPage = async () => {
      const copyrightAndLicense = await generateCopyrightAndLicenseHTML(
        catalogEntry,
        builtWith,
        authToken,
      );
      setCopyright(copyrightAndLicense);
    };

    if (catalogEntry && builtWith.length) {
      generateCopyrightPage();
    }
  }, [catalogEntry, builtWith, authToken, setCopyright]);

  useEffect(() => {
    const handleRenderedDataFromUsfmToHtmlHook = async () => {
      let _html = renderedData.replaceAll(
        /<span id="chapter-(\d+)-verse-(\d+)"([^>]*)>(\d+)<\/span>/g,
        `<span id="nav-${bookId}-$1-$2"$3><a href="#nav-${bookId}-$1-$2" class="header-link">$4</a></span>`
      );
      _html = _html.replaceAll(
        /<span id="chapter-(\d+)"([^>]+)>([\d]+)<\/span>/gi,
        `<span id="nav-${bookId}-$1" data-toc-title="${bookTitle} $1"$2><a href="#nav-${bookId}-$1-1" class="header-link">$3</a></span>`
      );
      _html = _html.replaceAll(/<span([^>]+style="[^">]+#CCC[^">]+")/gi, `<span$1 class="footnote"`);
      _html = `<div class="section bible-book" id="nav-${bookId}" data-toc-title="${bookTitle}">${_html}</div>`;
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

    if (htmlReady && renderedData && copyright) {
      handleRenderedDataFromUsfmToHtmlHook();
    }
  }, [bookId, htmlReady, renderedData, copyright, bookTitle, setHtmlSections, setStatusMessage, setErrorMessage]);

  return (
    <ThemeProvider theme={theme}>
      <BibleReference status={bibleReferenceState} actions={bibleReferenceActions} />
    </ThemeProvider>
  );
}
