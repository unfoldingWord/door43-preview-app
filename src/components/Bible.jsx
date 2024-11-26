// React imports
import { useState, useEffect, useContext } from 'react';

// Material UI imports
import { ThemeProvider, createTheme } from '@mui/material';

// USFM parsing library
import usfm from 'usfm-js';
import { removeAlignments } from '@helpers/usfm';

// Custom hooks
import useUsfmPreviewRenderer from '@hooks/useUsfmPreviewRender';

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

.web-preview .paras_usfm_f {
  padding-left: 0.5em;
  padding-right: 0.5em;
  background-color: #CCC;
  margin-top: 1em;
  margin-bottom: 1em;
}

.paras_usfm_fq, .paras_usfm_fqa {
  font-style: italic;
}
`;

export default function Bible() {
  const {
    state: {
      urlInfo,
      catalogEntry,
      navAnchor,
      authToken,
      bookId,
      lastBookId,
      bookTitle,
      supportedBooks,
      builtWith,
      htmlSections,
      errorMessages,
      cachedHtmlSections,
      renderOptions,
      extraDownloadButtons,
    },
    actions: {
      setBookId,
      setBookTitle,
      setBuiltWith,
      setSupportedBooks,
      setStatusMessage,
      setErrorMessage,
      setHtmlSections,
      setNavAnchor,
      setCanChangeColumns,
      setPrintOptions,
      setLastBookId,
      setExtraDownloadButtons,
    },
  } = useContext(AppContext);

  const [usfmText, setUsfmText] = useState();
  const [copyright, setCopyright] = useState('');

  const renderFlags = {
    showWordAtts: false,
    showTitles: true,
    showHeadings: true,
    showFootnotes: true,
    showXrefs: true,
    showChapterLabels: true,
    showVersesLabels: true,
    showCharacterMarkup: true,
    showParaStyles: true,
    selectedBcvNotes: [],
  };

  const onBibleReferenceChange = (b, c, v) => {
    if (b != (bookId || urlInfo.hashParts[0].toLowerCase() || lastBookId || 'gen')) {
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
    initialBook: bookId || urlInfo.hashParts[0].toLowerCase() || lastBookId || 'gen',
    initialChapter: urlInfo.hashParts[1] || '1',
    initialVerse: urlInfo.hashParts[2] || '1',
    onChange: onBibleReferenceChange,
  });

  const { renderedData, htmlReady } = useUsfmPreviewRenderer({
    bookId,
    usfmText,
    renderFlags,
    renderStyles: catalogEntry?.language_direction === 'rtl' ? getRtlPreviewStyle() : getLtrPreviewStyle(),
    htmlRender: true,
    setErrorMessage,
    chapters: renderOptions?.chapters,
  });

  useEffect(() => {
    if (catalogEntry) {
      setBuiltWith([catalogEntry]);
    }
  }, [catalogEntry, setBuiltWith]);

  useEffect(() => {
    if (navAnchor && !navAnchor.includes('--')) {
      const parts = navAnchor.split('-');
      if (bibleReferenceState.bookId != parts[0] || bibleReferenceState.chapter != parts[1] || bibleReferenceState.verse != parts[2]) {
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

      let repoFileList = null;
      try {
        repoFileList = (await getRepoGitTrees(catalogEntry.repo.url, catalogEntry.branch_or_tag_name, authToken, true)).map((tree) => tree.path);
      } catch (e) {
        console.log(`Error calling getRepoGitTrees(${catalogEntry.repo.url}, ${catalogEntry.branch_or_tag_name}, true): `, e);
      }

      let sb = getSupportedBooks(catalogEntry, repoFileList);
      if (!sb.length) {
        setErrorMessage('There are no books in this resource to render.');
        return;
      }

      let _bookId = urlInfo.hashParts[0] || (sb.includes(lastBookId) ? lastBookId : sb[0]);
      if (!_bookId) {
        setErrorMessage('Unable to determine a book ID to render.');
        return;
      }
      const title = catalogEntry.ingredients.filter((ingredient) => ingredient.identifier == _bookId).map((ingredient) => ingredient.title)[0] || _bookId;
      setBookId(_bookId);
      setLastBookId(_bookId);
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
      setPrintOptions((prevState) => ({ ...prevState, columns: 2 }));
    };

    setInitialBookIdAndSupportedBooks();
  }, [
    urlInfo,
    catalogEntry,
    authToken,
    lastBookId,
    setBookId,
    setBookTitle,
    setCanChangeColumns,
    setErrorMessage,
    setPrintOptions,
    setStatusMessage,
    setSupportedBooks,
    setLastBookId,
  ]);

  useEffect(() => {
    const handleUSFMClick = () => {
      const fileName = `${catalogEntry.repo.name}_${catalogEntry.branch_or_tag_name}${bookId && `_${bookId}`}.usfm`;
      const fileContent = usfmText || '';
      const blob = new Blob([fileContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    };

    if (bookId && catalogEntry && usfmText) {
      setExtraDownloadButtons((prevButtons) => {
        const noUsfmButtons = prevButtons.filter(buttonData => buttonData.label !== "USFM");
        const newButton = {
          label: 'USFM',
          onClick: handleUSFMClick,
          tooltip: 'Download the USFM used to render this book (no alignments)',
        };
        // Check if the new button is already in the list to avoid unnecessary updates
        const isButtonPresent = noUsfmButtons.some(button => button.label === newButton.label);
        if (!isButtonPresent) {
          return [...noUsfmButtons, newButton];
        }
        return prevButtons;
      });
    }
  }, [bookId, usfmText, catalogEntry, setExtraDownloadButtons]);

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

      getRepoContentsContent(catalogEntry.repo.url, filePath, catalogEntry.commit_sha, authToken, false)
        .then((_usfmText) => {
          _usfmText = removeAlignments(_usfmText);
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

    if (!htmlSections?.body && catalogEntry && supportedBooks && bookId && supportedBooks.includes(bookId) && !errorMessages) {
      fetchUsfmFileFromDCS();
    }
  }, [htmlSections, supportedBooks, catalogEntry, bookId, authToken, setBookTitle, setErrorMessage]);

  useEffect(() => {
    const generateCopyrightPage = async () => {
      const copyrightAndLicense = await generateCopyrightAndLicenseHTML(catalogEntry, builtWith, authToken);
      setCopyright(copyrightAndLicense);
    };

    if (catalogEntry && builtWith.length) {
      generateCopyrightPage();
    }
  }, [catalogEntry, builtWith, authToken, setCopyright]);

  useEffect(() => {
    const numberSpans = document.querySelectorAll('.footnote-number');
    numberSpans.forEach((numberSpan) => {
      numberSpan.remove();
    });

    const toggleFootnotes = () => {
      const footnotes = document.querySelectorAll('.paras_usfm_f');
      footnotes.forEach((footnote) => {
        const isFootnoteVisible = footnote.style.display === 'inline';
        footnote.style.display = isFootnoteVisible ? 'none' : 'inline';
      });
    };

    const footnotes = document.querySelectorAll('.paras_usfm_f');
    footnotes.forEach((footnote, index) => {
      const numberSpan = document.createElement('span');
      numberSpan.className = 'footnote-number';
      numberSpan.style.cssText = 'vertical-align: super; font-size: x-small; font-weight: bold; margin-right: 0.25em; padding: 2px; background-color: rgb(204, 204, 204);';
      numberSpan.textContent = index + 1;
      numberSpan.title = footnote.textContent.trim();
      numberSpan.style.cursor = 'pointer';

      footnote.style.display = 'none';
      footnote.style.cursor = 'pointer';

      footnote.parentNode.insertBefore(numberSpan, footnote);

      numberSpan.addEventListener('click', toggleFootnotes);
      footnote.addEventListener('click', toggleFootnotes);
    });

    // Cleanup function to remove event listeners
    return () => {
      const footnotes = document.querySelectorAll('.paras_usfm_f');
      footnotes.forEach((footnote) => {
        footnote.removeEventListener('click', toggleFootnotes);
      });
      const numberSpans = document.querySelectorAll('.footnote-number');
      numberSpans.forEach((numberSpan) => {
        numberSpan.removeEventListener('click', toggleFootnotes);
        numberSpan.remove();
      });
    };
  }, [htmlSections?.body, cachedHtmlSections?.body]);

  useEffect(() => {
    const handleRenderedDataFromUsfmToHtmlHook = async () => {
      if (!renderedData) {
        setErrorMessage('No text was found for this book.');
        return;
      }
      let _html = renderedData.replaceAll(
        /<span id="chapter-(\d+)-verse-(\d+)"([^>]*)>(\d+)<\/span>/g,
        `<span id="nav-${bookId}-$1-$2"$3><a href="#nav-${bookId}-$1-$2" class="header-link">$4</a></span>`
      );
      _html = _html.replaceAll(
        /<span id="chapter-(\d+)"([^>]+)>([\d]+)<\/span>/gi,
        `<span id="nav-${bookId}-$1" data-toc-title="${bookTitle} $1"$2><a href="#nav-${bookId}-$1-1" class="header-link">$3</a></span>`
      );
      _html = _html.replace(/<span([^>]+style="[^">]+#CCC[^">]+")/gi, `<span$1 class="footnote"`);

      // const footnotes = _html.match(/<span class="footnote">/g);
      // if (footnotes) {
      //   footnotes.forEach((footnote, index) => {
      //     const footnoteId = `footnote-${index}`;
      //     const anchor = `<a href="#${footnoteId}">${index + 1}.</a>`;
      //     _html = _html.replace(footnote, `${footnote}<span id="${footnoteId}">${anchor}</span>`);
      //   });
      // }

      _html = `
        <div class="section bible-book" id="nav-${bookId}" data-toc-title="${bookTitle}">
          ${_html}
        </div>
`;

      setHtmlSections((prevState) => {
        return {
          ...prevState,
          cover: `<h3 class="cover-book-title">${bookTitle}</h3>`,
          copyright,
          body: _html,
        };
      });
      setStatusMessage('');
      setHtmlSections((prevState) => {
        return { ...prevState, css: { web: webCss } };
      });
    };

    if (htmlReady && copyright) {
      handleRenderedDataFromUsfmToHtmlHook();
    }
  }, [bookId, htmlReady, renderedData, copyright, bookTitle, setHtmlSections, setStatusMessage, setErrorMessage]);

  return (
    <ThemeProvider theme={theme}>
      <BibleReference status={bibleReferenceState} actions={bibleReferenceActions} />
    </ThemeProvider>
  );
}
