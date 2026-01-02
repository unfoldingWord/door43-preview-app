// React imports
import { useState, useEffect, useContext } from 'react';

// Material UI imports
import { ThemeProvider, createTheme, Checkbox, FormControlLabel, Tooltip } from '@mui/material';

// USFM parsing library
import { removeAlignments } from '@helpers/usfm';

// Bible reference component
import BibleReference, { useBibleReference } from 'bible-reference-rcl';

// Helper functions and constants
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

pre {
    font-family: inherit;
    font-size: inherit;
    padding-left: 2rem;
    background-color: #f8f8f8;
    border-radius: 4px;
    overflow-x: auto;
    border: 1px solid #e9ecef;
    margin: 1em 0;
}

pre code {
    border-radius: unset;
    background: inherit;
    padding: 0;
    margin: 0;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
}

/* Inline code styling */
code {
    background-color: #f4f4f4;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
    color: #d63384;
}

/* Lists (existing + enhanced) */
ol {
    list-style: decimal;
}

ol ol {
    list-style: upper-alpha;
}

ol ol ol {
    list-style: upper-roman;
}

ol ol ol ol {
    list-style: lower-roman;
}

ol ol ol ol ol {
    list-style: lower-alpha;
}

ul, ol {
    margin: 1em 0;
    padding-left: 2em;
}

li {
    margin: 0.5em 0;
}

/* Blockquote (existing style kept) */
blockquote {
    margin-left: 40px;
    margin-right: 40px;
    color: #333;
    padding: 1.5em;
    line-height: 1.6;
    border-left: 4px solid #ccc;
    background-color: #f9f9f9;
}

blockquote cite {
    display: block;
    text-align: right;
    font-size: .9em;
    color: #666;
    margin-top: 1em;
}

blockquote p {
    margin: 0.5em 0;
}

blockquote p:first-child {
    margin-top: 0;
}

blockquote p:last-child {
    margin-bottom: 0;
}

/* Tables */
table {
    border-collapse: collapse;
    width: 100%;
    margin: 1.5em 0;
    border: 1px solid #dee2e6;
}

th, td {
    border: 1px solid #dee2e6;
    padding: 8px 12px;
    text-align: left;
}

th {
    background-color: #f8f9fa;
    font-weight: bold;
    color: #495057;
}

tbody tr:nth-child(even) {
    background-color: #f9f9f9;
}

/* Headings */
h1, h2, h3, h4, h5, h6 {
    color: #495057;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: bold;
    line-height: 1.2;
}

h1 {
    font-size: 2em;
    padding-bottom: 0.3em;
}

h2 {
    font-size: 1.5em;
}

h3 {
    font-size: 1.25em;
}

/* Paragraphs */
p {
    margin: 1em 0;
    line-height: 1.6;
}

/* Links */
a {
    color: #007acc;
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

a.internal-link {
    color: #007acc;
    cursor: s-resize;
}

a.external-link {
    position: relative;
    font-weight: bold !important;
    color: #666 !important;
    border-bottom: dashed 1px #666 !important;
    text-decoration: none !important;
    cursor: ne-resize !important;
}

a.external-link::after {
    content: ' 🔗';
    font-size: 0.8em;
vertical-align: super;
}

.back-refs a {
    position: relative;
    cursor: n-resize;
}

/* Verse references and biblical text */
.verse-ref {
    font-weight: bold;
    color: #0066cc;
    text-decoration: none;
}

.verse-ref:hover {
    text-decoration: underline;
}

/* Translation notes specific styling */
.translation-note {
    background-color: #fff3cd;
    border: 1px solid #ffeaa7;
    padding: 1em;
    margin: 1em 0;
    border-radius: 4px;
    border-left: 4px solid #ffc107;
}

.note-header {
    font-weight: bold;
    color: #856404;
    margin-bottom: 0.5em;
}

/* Cross-references */
.cross-ref {
    font-size: 0.9em;
    color: #6c757d;
    font-style: italic;
}

/* Hebrew/Greek original text */
.original-text,
.hebrew-text {
    font-family: "Ezra", "SBL Hebrew", "Times New Roman", serif;
    font-size: 1.1em;
    font-weight: normal;
    direction: rtl;
}

.greek-text {
    font-family: "CharisSIL", "SBL Greek", "Gentium Plus", "Times New Roman", serif;
    font-size: 1.1em;
    direction: ltr;
}

/* Strong's numbers */
.strongs {
    font-size: 0.8em;
    color: #6c757d;
    font-weight: normal;
}

/* Emphasis and formatting */
strong, b {
    font-weight: bold;
}

em, i {
    font-style: italic;
}

/* Horizontal rules */
hr {
    border: none;
    height: 1px;
    background-color: #dee2e6;
    margin: 2em 0;
}

/* Highlighting for search results or important text */
mark, .highlight {
    background-color: #fff3cd;
    padding: 1px 2px;
    border-radius: 2px;
}

/* Responsive images */
img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1em auto;
}

/* Definition lists for glossary terms */
dl {
    margin: 1em 0;
}

dt {
    font-weight: bold;
    margin-top: 1em;
    color: #495057;
}

dd {
    margin-left: 2em;
    margin-bottom: 0.5em;
}

/* Footnotes */
.footnote {
    font-size: 0.9em;
    color: #6c757d;
    border-top: 1px solid #dee2e6;
    padding-top: 0.5em;
    margin-top: 2em;
}

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

.implied-word-text {
  color: #999;
  font-weight: bold;
  font-size: 0.9em;
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

const parseHtml = (html, book, showChapters = true) => {
  const titleMatch = html.match(/<p [^>]*>(.*?)<\/p>/);
  const title = titleMatch ? titleMatch[1] : '';
  html = html.replace(/<p /, `<p id="nav-${book}" `);
  html = html.replaceAll(
    /<span id="chapter-(\d+)-verse-(\d+)"([^>]*)>(\d+)<\/span>/g,
    `<span id="nav-${book}-$1-$2"$3><a href="#nav-${book}-$1-$2" class="header-link">$4</a></span>`
  );
  html = html.replaceAll(
    /<span id="chapter-(\d+)"([^>]+)>([\d]+)<\/span>/gi,
    `<span id="nav-${book}-$1"${showChapters ? ` data-toc-title="${title} $1"` : ''}$2><a href="#nav-${book}-$1-1" class="header-link">$3</a></span>`
  );
  html = html.replace(/<span([^>]+style="[^">]+#CCC[^">]+")/gi, `<span$1 class="footnote"`);

  html = html.replace(/(\d+),\s+(\d{3})(?!\d)/g, '$1,$2');

  const footnotes = html.match(/<span class="footnote">/g);
  if (footnotes) {
    footnotes.forEach((footnote, index) => {
      const footnoteId = `footnote-${index}`;
      const anchor = `<a href="#${footnoteId}">${index + 1}.</a>`;
      html = html.replace(footnote, `${footnote}<span id="${footnoteId}">${anchor}</span>`);
    });
  }

  html = `
    <div class="section bible-book" id="nav-${book}" data-toc-title="${title}">
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
      books,
      expandedBooks,
      bookTitle,
      supportedBooks,
      builtWith,
      htmlSections,
      errorMessages,
      cachedHtmlSections,
      renderNewCopy,
      renderOptions,
      view,
    },
    actions: {
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
      setExtraDownloadButtons,
      setIsDefaultBook,
    },
  } = useContext(AppContext);

  const [copyright, setCopyright] = useState('');
  const [showUsfmAsHtml, setShowUsfmAsHtml] = useState(false);
  const [html, setHtml] = useState('');
  const [usfmMap, setUsfmMap] = useState(new Map());

  const onBibleReferenceChange = (b, c, v) => {
    if (expandedBooks.length && !expandedBooks.includes(b)) {
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
    initialBook: expandedBooks?.[0] || books[0] || catalogEntry?.ingredients?.[0]?.identifier || 'gen',
    initialChapter: parseInt(urlInfo.hashParts[1]) || 1,
    initialVerse: parseInt(urlInfo.hashParts[2]) || 1,
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

      let sb = getSupportedBooks(catalogEntry, repoFileList, expandedBooks.length > 1 ? expandedBooks : []);
      if (!sb.length) {
        setErrorMessage('There are no books in this resource to render.');
        return;
      }
      if (expandedBooks.length === 1 && sb?.[0] == expandedBooks[0]) {
        setIsDefaultBook(true);
      }

      setStatusMessage(
        <>
          Preparing preview for {books.join(', ')}.
          <br />
          Please wait...
        </>
      );

      for (const _book of expandedBooks) {
        if (!sb.includes(_book)) {
          setErrorMessage(`This resource does not support the rendering of the book \`${_book}\`. Please choose another book to render.`);
          sb = [_book, ...sb];
        }
      }

      setSupportedBooks(sb);
      bibleReferenceActions.applyBooksFilter(sb);

      setCanChangeColumns(true);
      setPrintOptions((prevState) => ({ ...prevState, columns: 2 }));
    };

    if (catalogEntry && !supportedBooks.length && !errorMessages && expandedBooks.length) {
      setInitialBookIdAndSupportedBooks();
    }
  }, [
    books,
    expandedBooks,
    supportedBooks,
    errorMessages,
    urlInfo,
    catalogEntry,
    authToken,
    setBookTitle,
    setCanChangeColumns,
    setErrorMessage,
    setPrintOptions,
    setStatusMessage,
    setSupportedBooks,
    setNoCache,
    setRenderMessage,
    setIsDefaultBook,
  ]);

  useEffect(() => {
    const handleUSFMClick = () => {
      const fileName = `${catalogEntry.repo.name}_${catalogEntry.branch_or_tag_name}_${books.join('-')}.usfm`;
      const fileContent = Array.from(usfmMap.values()).join('\n\n\n');
      const blob = new Blob([fileContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    };

    if (catalogEntry && usfmMap && books.length) {
      setExtraDownloadButtons((prevButtons) => {
        const noUsfmButtons = prevButtons.filter((buttonData) => buttonData.label !== 'USFM');
        const newButton = {
          label: 'USFM',
          onClick: handleUSFMClick,
          tooltip: 'Download the USFM used to render this book (no alignments)',
        };
        // Check if the new button is already in the list to avoid unnecessary updates
        const isButtonPresent = noUsfmButtons.some((button) => button.label === newButton.label);
        if (!isButtonPresent) {
          return [...noUsfmButtons, newButton];
        }
        return prevButtons;
      });
    }
  }, [usfmMap, catalogEntry, books, setExtraDownloadButtons]);

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
      const titles = [];
      for (const ingredient of catalogEntry.ingredients) {
        if (!expandedBooks.includes(ingredient.identifier)) {
          continue;
        }
        titles.push(ingredient.title);
        const filePath = ingredient.path.replace(/^\.\//, '');
        let usfm = '';
        try {
          usfm = await getRepoContentsContent(catalogEntry.repo.url, filePath, catalogEntry.commit_sha, authToken, false);
        } catch (e) {
          console.log(`Error calling getRepoContentsContent(${catalogEntry.repo.url}, ${filePath}, ${catalogEntry.commit_sha}): `, e);
          setErrorMessage(`Unable to get content for book \`${ingredient.identifier}\` from DCS`);
          continue;
        }
        usfm = removeAlignments(usfm);
        usfm = usfm.replace(/\\s5 *\n/g, '');
        usfms.set(ingredient.identifier, usfm);
        if (!html && renderNewCopy) {
          let res;
          try {
            res = pk.importDocument(
              { lang: 'xxx', abbr: 'XXX' }, // doesn't matter...
              'usfm',
              usfm
            );
            if (!res.id) {
              console.log(`Failed to import book for rendering.`);
              continue;
            } else {
              docIds.push(res.id);
            }
          } catch (e) {
            console.log(`Error calling pk.importDocument(): `, e);
          }
          const output = {};
          renderer.renderDocument({
            config,
            docId: res.id,
            output,
          });
          htmls.push(parseHtml(output.paras, ingredient.identifier, books.length < 3));
        }
      }
      setUsfmMap(usfms);
      if (htmls.length) {
        setBookTitle(titles.join(', '));
        setHtml(htmls.join('\n'));
      }
    };

    if (catalogEntry && supportedBooks && expandedBooks && supportedBooks.includes(expandedBooks[0]) && !errorMessages) {
      fetchUsfmFileFromDCS();
    }
  }, [html, books, renderNewCopy, supportedBooks, catalogEntry, expandedBooks, authToken, errorMessages, setBookTitle, setErrorMessage]);

  useEffect(() => {
    const generateCopyrightPage = async () => {
      const copyrightAndLicense = await generateCopyrightAndLicenseHTML(catalogEntry, builtWith, authToken);
      setCopyright(copyrightAndLicense);
    };

    if (catalogEntry && builtWith.length && renderNewCopy) {
      generateCopyrightPage();
    }
  }, [catalogEntry, builtWith, authToken, renderNewCopy, setCopyright]);

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
          css: { web: webCss + (!renderOptions.editorMode ? '.implied-word-start, .implied-word-end { display: none }' : '') },
        };
      });
      setStatusMessage('');
    };

    if (html && copyright) {
      handleHtml();
    }
  }, [html, copyright, bookTitle, setHtmlSections, setStatusMessage, setErrorMessage]);

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
          webView: `<div>${usfms.join('\n\n<hr/>\n\n').replace(/\n/g, '<br/>')}</div>`,
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
  }, [showUsfmAsHtml, usfmMap, setHtmlSections]);

  return (
    <ThemeProvider theme={theme}>
      <BibleReference status={bibleReferenceState} actions={bibleReferenceActions} />
      {view === 'web' && usfmMap.size ? (
        <Tooltip title="Shows the raw unaligned USFM" arrow>
          <FormControlLabel
            control={
              <Checkbox
                checked={showUsfmAsHtml}
                onChange={() => {
                  setShowUsfmAsHtml(!showUsfmAsHtml);
                  setNoCache(true);
                }}
                name="showUsfmAsHtml"
                color="primary"
                style={{ padding: 0 }}
              />
            }
            label="USFM"
          />
        </Tooltip>
      ) : null}
    </ThemeProvider>
  );
}
