// React imports
import { useState, useEffect, useContext } from 'react';

// Material UI imports
import { ThemeProvider, createTheme } from '@mui/material';

// USFM parsing library
import usfm from 'usfm-js';

// Custom hooks
import useUsfmPreviewRenderer from '../hooks/useUsfmPreviewRender';

// Bible reference component
import BibleReference from 'bible-reference-rcl';

// Helper functions and constants
import { getLtrPreviewStyle, getRtlPreviewStyle } from '@helpers/previewStyling.js';
import { getSupportedBooks } from '@helpers/books';
import { getRepoContentsContent, getRepoGitTrees } from '@helpers/dcsApi';

// Context
import { AppContext } from '@components/App.context';

// Bible reference hook and data
import { useBibleReference } from 'bible-reference-rcl';
import { BibleBookData } from '@common/books';

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

const printCss = `
@page {
  @footnote { 
    float: bottom;
    border-top: solid black 1px;
    padding-top: 1em;
    margin-top: 1em;
 }
 counter-reset: footnote;
}

span.footnote {
  float: footnote;
  position: note(footnotes);
}

::footnote-call { 
  /* content: counter(footnote, lower-alpha); */
  font-weight: 700;
  font-size: 1em;
  line-height: 0; 
}

::footnote-marker {
  /* content: counter(footnote, lower-alpha) ". "; */
  font-weight: 700;
  line-height: 0; 
  font-style: italic !important;
}

.pagedjs_footnote_area * {
  background-color: white !important;
}

a.footnote {
  font-style: italic !important;
}
`;

export default function Bible() {
  const {
    state: { urlInfo, catalogEntry, navAnchor, authToken, bookId, bookTitle, supportedBooks, htmlSections },
    actions: { setBookId, setBookTitle, setBuiltWith, setSupportedBooks, setStatusMessage, setErrorMessage, setHtmlSections, setNavAnchor, setCanChangeColumns, setPrintOptions },
  } = useContext(AppContext);

  const [usfmText, setUsfmText] = useState();

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
    if (bookId && b != bookId) {
      window.location.hash = b;
      window.location.reload();
    } else if (setNavAnchor) {
      setNavAnchor(`${b}-${c}-${v}`);
    }
  };

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: bookId || urlInfo.hashParts[0] || 'gen',
    initialChapter: urlInfo.hashParts[1] || '1',
    initialVerse: urlInfo.hashParts[2] || '1',
    onChange: onBibleReferenceChange,
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
    if (navAnchor && navAnchor.split('-').length == 3) {
      const parts = navAnchor.split('-');
      if (bibleReferenceState.bookId != parts[0] || bibleReferenceState.chapter != parts[1] || bibleReferenceState.verse != parts[2]) {
        bibleReferenceActions.goToBookChapterVerse(parts[0], parts[1], parts[2]);
      }
    }
  }, [navAnchor]);

  useEffect(() => {
    const setInitialBookIdAndSupportedBooks = async () => {
      if (!catalogEntry) {
        setErrorMessage('No catalog entry for this resource found.');
        return;
      }

      let repoFileList = null;
      try {
        repoFileList = (await getRepoGitTrees(catalogEntry.repo.url, catalogEntry.branch_or_tag_name, authToken, true)).tree.map((tree) => tree.path);
      } catch (e) {
        console.log(`Error calling getRepoGitTrees(${catalogEntry.repo.url}, ${catalogEntry.branch_or_tag_name}, true): `, e);
      }

      let sb = getSupportedBooks(catalogEntry, repoFileList);
      if (!sb.length) {
        setErrorMessage('There are no books in this resource to render.');
        return;
      }
      setSupportedBooks(sb);
      bibleReferenceActions.applyBooksFilter(sb);

      let _bookId = urlInfo.hashParts[0] || sb[0] || bookId;
      if (!_bookId) {
        setErrorMessage('Unable to determine a book ID to render.');
        return;
      }
      const title = catalogEntry.ingredients.filter((ingredient) => ingredient.identifier == _bookId).map((ingredient) => ingredient.title)[0] || _bookId;
      setBookId(_bookId);
      setBookTitle(title);
      setStatusMessage(
        <>
          Preparing preview for {title}.<br />
          Please wait...
        </>
      );
      if (!sb.includes(_bookId)) {
        setErrorMessage(`This resource does not support the rendering of the book \`${_bookId}\`. Please choose another book to render.`);
        sb = [_bookId, ...sb];
        return;
      }
      setCanChangeColumns(true);
      setPrintOptions((prevState) => ({ ...prevState, columns: 2 }));
    };

    setInitialBookIdAndSupportedBooks();
  }, [urlInfo, catalogEntry]);

  useEffect(() => {
    const fetchUsfmFileFromDCS = async () => {
      if (!(bookId in BibleBookData)) {
        setErrorMessage(`Invalid book: ${bookId}`);
        return;
      }

      let filePath = '';
      catalogEntry.ingredients.forEach((ingredient) => {
        if (ingredient.identifier == bookId) {
          filePath = ingredient.path.replace(/^\.\//, '');
        }
      });
      if (!filePath) {
        setErrorMessage(`Book \`${bookId}\` is not in repo's project list.`);
      }

      getRepoContentsContent(catalogEntry.repo.url, filePath, catalogEntry.commit_sha, authToken)
        .then((_usfmText) => {
          const usfmJSON = usfm.toJSON(_usfmText);
          for (let i = 0; i < usfmJSON?.headers?.length; ++i) {
            if (usfmJSON.headers[i].tag && (usfmJSON.headers[i].tag == 'h' || usfmJSON.headers[i].tag.startsWith('toc'))) {
              setBookTitle(usfmJSON.headers[i].content);
              break;
            }
          }
          setUsfmText(_usfmText);
        })
        .catch((e) => {
          console.log(`Error calling getRepoContentsContent(${catalogEntry.repo.url}, ${filePath}, ${catalogEntry.commit_sha}): `, e);
          setErrorMessage(`Unable to get content for book \`${bookId}\` from DCS`);
        });
    };

    if (! htmlSections?.body && catalogEntry && supportedBooks && bookId && supportedBooks.includes(bookId)) {
      fetchUsfmFileFromDCS();
    }
  }, [htmlSections, supportedBooks, catalogEntry, bookId, setErrorMessage]);

  useEffect(() => {
    const handleRenderedDataFromUsfmToHtmlHook = async () => {
      let _html = renderedData.replaceAll(
        /<span id="chapter-(\d+)-verse-(\d+)"([^>]*)>(\d+)<\/span>/g,
        `<span id="bible-${bookId}-$1-$2" data-nav-id="${bookId}-$1-$2"$3><a href="#bible-${bookId}-$1-$2" data-nav-anchor="${bookId}-$1-$2" class="header-link">$4</a></span>`
      );
      _html = _html.replaceAll(
        /<span id="chapter-(\d+)"([^>]+)>([\d]+)<\/span>/gi,
        `<span id="${bookId}-$1" data-toc-title="${bookTitle} $1" data-nav-id="${bookId}-$1"$2><a href="#${bookId}-$1-1" data-nav-anchor="${bookId}-$1-1" class="header-link">$3</a></span>`
      );
      _html = _html.replaceAll(/<span([^>]+style="[^">]+#CCC[^">]+")/gi, `<span$1 class="footnote"`);
      
      // const footnotes = _html.match(/<span class="footnote">/g);
      // if (footnotes) {
      //   footnotes.forEach((footnote, index) => {
      //     const footnoteId = `footnote-${index}`;
      //     const anchor = `<a href="#${footnoteId}">${index + 1}.</a>`;
      //     _html = _html.replace(footnote, `${footnote}<span id="${footnoteId}">${anchor}</span>`);
      //   });
      // }
      
      _html = `<section class="bible-book" id="bible-${bookId}" data-nav-anchor="${bookId}" data-toc-title="${bookTitle}">${_html}</section>`;
      
      setHtmlSections({ cover: `<h3 class="cover-book-title">${bookTitle}</h3>`, toc: '', body: _html });
      setStatusMessage('');
      setHtmlSections((prevState) => {return {...prevState, css: {web: webCss, print: printCss}}});
    };

    if (htmlReady && renderedData) {
      handleRenderedDataFromUsfmToHtmlHook();
    }
  }, [bookId, htmlReady, renderedData, bookTitle, setHtmlSections, setStatusMessage, setErrorMessage]);

  return (
    <ThemeProvider theme={theme}>
      <BibleReference status={bibleReferenceState} actions={bibleReferenceActions} />
    </ThemeProvider>
  );
}
