// React imports
import { useState, useEffect, useContext } from 'react';

// Material UI imports
import { ThemeProvider, createTheme, Checkbox, FormControlLabel, Tooltip } from '@mui/material';

// USFM parsing library
import { removeAlignments } from '@helpers/usfm';

// Bible reference component
import BibleReference, { useBibleReference } from 'bible-reference-rcl';

// Helper functions and constants
import { getLtrPreviewStyle, getRtlPreviewStyle } from '@helpers/previewStyling.js';
import { getSupportedBooks } from '@helpers/books';
import { getRepoGitTrees } from '@helpers/dcsApi';
import { getRepoContentsContent } from '@helpers/dcsApi';

// Context
import { AppContext } from '@components/App.context';

// Bible reference hook and data
import { generateCopyrightAndLicenseHTML } from '@helpers/html';
import { Proskomma } from 'proskomma-core';
import { SofriaRenderFromProskomma } from 'proskomma-json-tools';
import { render } from 'proskomma-json-tools';
import { renderers } from '@renderer/sofria2html';

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
${render.sofria2web.renderStyles.styleAsCSS(render.sofria2web.renderStyles.styles)}

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

const defaultFlags = {
  showWordAtts: false,
  showTitles: true,
  showHeadings: true,
  showIntroductions: true,
  showFootnotes: true,
  showXrefs: true,
  showParaStyles: true,
  showCharacterMarkup: true,
  showChapterLabels: true,
  showVersesLabels: true,
};

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

const pk = new Proskomma();

const parseHtml = (html, bookId, showChapters=true) => {
  const titleMatch = html.match(/<p [^>]*>(.*?)<\/p>/);
  const title = titleMatch ? titleMatch[1] : '';
  html = html.replace(/<p /, `<p id="nav-${bookId}" `)
  html = html.replaceAll(
    /<span id="chapter-(\d+)-verse-(\d+)"([^>]*)>(\d+)<\/span>/g,
    `<span id="nav-${bookId}-$1-$2"$3><a href="#nav-${bookId}-$1-$2" class="header-link">$4</a></span>`
  );
  html = html.replaceAll(
    /<span id="chapter-(\d+)"([^>]+)>([\d]+)<\/span>/gi,
    `<span id="nav-${bookId}-$1"${showChapters ? ` data-toc-title="${title} $1"` : ''}$2><a href="#nav-${bookId}-$1-1" class="header-link">$3</a></span>`
  );
  html = html.replace(/<span([^>]+style="[^">]+#CCC[^">]+")/gi, `<span$1 class="footnote"`);

  const footnotes = html.match(/<span class="footnote">/g);
  if (footnotes) {
    footnotes.forEach((footnote, index) => {
      const footnoteId = `footnote-${index}`;
      const anchor = `<a href="#${footnoteId}">${index + 1}.</a>`;
      html = html.replace(footnote, `${footnote}<span id="${footnoteId}">${anchor}</span>`);
    });
  }

  html = `
    <div class="section bible-book" id="nav-${bookId}" data-toc-title="${title}">
      ${html}
    </div>
  `;

  return html;
};


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
      view,
      books,
    },
    actions: {
      setBookId,
      setBookTitle,
      setBuiltWith,
      setSupportedBooks,
      setNoCache,
      setRenderMessage,
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

  const [copyright, setCopyright] = useState('');
  const [showUsfmAsHtml, setShowUsfmAsHtml] = useState(false);
  const [html, setHtml] = useState('');
  const [usfmMap, setUsfmMap] = useState(new Map());

  const onBibleReferenceChange = (b, c, v) => {
    console.log(b, c, v, books.length, books);
    if (books.length > 0 && ! books.includes(b)) {
      window.location.hash = b;
      const url = new URL(window.location);
      url.searchParams.delete('book');
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
    initialBook: bookId || urlInfo.hashParts[0]?.toLowerCase() || lastBookId || books[0] || 'gen',
    initialChapter: urlInfo.hashParts[1] || '1',
    initialVerse: urlInfo.hashParts[2] || '1',
    onChange: onBibleReferenceChange,
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
      let repoFileList = null;
      try {
        repoFileList = (await getRepoGitTrees(catalogEntry.repo.url, catalogEntry.branch_or_tag_name, authToken, true)).map((tree) => tree.path);
      } catch (e) {
        console.log(`Error calling getRepoGitTrees(${catalogEntry.repo.url}, ${catalogEntry.branch_or_tag_name}, true): `, e);
      }

      if (books.length > 1) {
        setNoCache(true);
        setRenderMessage('Preparing preview for multiple books. Please wait...');
      }

      let sb = getSupportedBooks(catalogEntry, repoFileList, books.length > 1 ? books : []);
      if (!sb.length) {
        setErrorMessage('There are no books in this resource to render.');
        return;
      }

      let _bookId = urlInfo.hashParts[0] || (sb.includes(lastBookId) && lastBookId) || books[0] || sb[0];
      if (!_bookId) {
        setErrorMessage('Unable to determine a book ID to render.');
        return;
      }
      setBookId(_bookId);
      setLastBookId(_bookId);
      setStatusMessage(
        <>
          Preparing preview for {books.join(', ')}.
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

    if (catalogEntry && !supportedBooks.length && !errorMessages) {
      setInitialBookIdAndSupportedBooks();
    }
  }, [
    books,
    supportedBooks,
    errorMessages,
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
      const fileContent = Object.values(usfmMap || {}).join("\n\n\n") || '';
      const blob = new Blob([fileContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    };

    if (bookId && catalogEntry && usfmMap) {
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
  }, [bookId, usfmMap, catalogEntry, setExtraDownloadButtons]);

  useEffect(() => {
    const fetchUsfmFileFromDCS = async () => {
      const docIds = [];
      const config = {
        ...defaultFlags,
        ...renderFlags,
        selectedBcvNotes: [],
        renderers,
      };
      const renderer = new SofriaRenderFromProskomma({
        proskomma: pk,
        actions: render.sofria2web.renderActions.sofria2WebActions,
      });
      const usfms = new Map();
      const htmls = [];
      for (const ingredient of catalogEntry.ingredients) {
        if ( (books.length > 0 && !books.includes(ingredient.identifier)) || (books.length === 0 && bookId !== ingredient.identifier)) {
          continue;
        }
        const filePath = ingredient.path.replace(/^\.\//, '');
        let usfm = '';
        try {
          usfm = await getRepoContentsContent(catalogEntry.repo.url, filePath, catalogEntry.commit_sha, authToken, false)
        } catch (e) {
          console.log(`Error calling getRepoContentsContent(${catalogEntry.repo.url}, ${filePath}, ${catalogEntry.commit_sha}): `, e);
          setErrorMessage(`Unable to get content for book \`${bookId}\` from DCS`);
          continue;
        }
        usfm = removeAlignments(usfm);
        usfms.set(ingredient.identifier, usfm);
        let res;
        try {
          res = pk.importDocument(
            { lang: 'xxx', abbr: 'XXX' }, // doesn't matter...
            'usfm',
            usfm
          );
          if (!res.id) {
            console.log('Failed to import book for rendering.');
            continue;
          } else {
            docIds.push(res.id);
          }
        } catch (e) {
          console.log(`Error calling pk.importDocument(): `, e);
        }
        try {
          const output = {};
          renderer.renderDocument({
            config,
            docId: res.id,
            output,
          });
          htmls.push(parseHtml(output.paras, ingredient.identifier, books.length  < 3));
        } catch (err) {
          console.log('Renderer', err);
          throw err;
        }
      }
      setUsfmMap(usfms);
      setHtml(htmls.join('\n'));
    };

    if (!html && catalogEntry && supportedBooks && bookId && supportedBooks.includes(bookId) && !errorMessages) {
      fetchUsfmFileFromDCS();
    }
  }, [html, books, supportedBooks, catalogEntry, bookId, authToken, errorMessages, setBookTitle, setErrorMessage]);

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
    const handleHtml = async () => {
      if (!html) {
        setErrorMessage('No text was found.');
        return;
      }

      setHtmlSections((prevState) => {
        return {
          ...prevState,
          cover: `<h3 class="cover-book-title">${bookTitle}</h3>`,
          copyright,
          body: html,
          css: { web: webCss}
        };
      });
      setStatusMessage('');
    };

    if (html && copyright) {
      handleHtml();
    }
  }, [bookId,  html, copyright, bookTitle, setHtmlSections, setStatusMessage, setErrorMessage]);

  useEffect(() => {
    if (showUsfmAsHtml && usfmMap.size) {
      const usfms = [];
      usfmMap.forEach((usfm, book) => {
        usfm = usfm
          .replace(/\\c (\d+)/g, `<span id="nav-${book}-$1" style="text-decoration: none; color: inherit;"/>\\c $1`)
          .replace(/\\id (...) /g, `<span id="nav-${book}" style="text-decoration: none; color: inherit;"/>\\id $1`);
        usfms.push(usfm);
      });
      setHtmlSections((prevState) => {
        return {
          ...prevState,
          webView: `<div>${usfms.join("\n\n<hr/>\n\n").replace(/\n/g, '<br/>')}</div>`,
        };
      });
    } else {
      setHtmlSections((prevState) => {
        return {
          ...prevState,
          webView: null,
        };
      });
    }
  }, [showUsfmAsHtml, usfmMap, setHtmlSections])

  return (
    <ThemeProvider theme={theme}>
      <BibleReference status={bibleReferenceState} actions={bibleReferenceActions} />
      {view === "web" && usfmMap.size ? <Tooltip title="Shows the raw unaligned USFM" arrow>
        <FormControlLabel
          control={
            <Checkbox
              checked={showUsfmAsHtml}
              onChange={() => setShowUsfmAsHtml(!showUsfmAsHtml)}
              name="showUsfmAsHtml"
              color="primary"
              style={{ padding: 0 }}
            />
          }
          label="USFM"
        />
      </Tooltip> : null}
    </ThemeProvider>
  );
}
