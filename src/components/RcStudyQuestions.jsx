// React imports
import { useState, useEffect, useContext, useMemo } from 'react';

// Bible reference imports
import BibleReference, { useBibleReference } from 'bible-reference-rcl';
import { BibleBookData } from '@common/books';

// Helper imports
import { getSupportedBooks } from '@helpers/books';
import { getRepoGitTrees } from '@helpers/dcsApi';
import { encodeHTML, convertNoteFromMD2HTML } from '@helpers/html';

// Hook imports
import useFetchRelationCatalogEntries from '@hooks/useFetchRelationCatalogEntries';
import useFetchCatalogEntriesBySubject from '@hooks/useFetchCatalogEntriesBySubject';
import useFetchBookFiles from '@hooks/useFetchBookFiles';
import usePivotTsvFileOnReference from '@hooks/usePivotTsvFileOnReference';
import useFetchGLQuotesForTsvData from '@hooks/useFetchGLQuotesForTsvData';

// Other imports
import usfm from 'usfm-js';
import { verseObjectsToString } from 'uw-quote-helpers';
import { insertUnmatchedCurlyBracesInQuote } from '@helpers/quotes';
import { generateCopyrightAndLicenseHTML } from '@helpers/html';

// Context imports
import { AppContext } from '@components/App.context';

const webCss = `
.sq-book-section-header {
  break-after: avoid !important;
}

.sq-scripture-block {
  border: 1px solid black;
  padding: 10px;
  margin-bottom: 10px;
}

.sq-scripture-header {
  margin: 0;
}

.sq-scripture-text {
  font-style: italic;
}

.sq-question-body h3 {
  font-size: 1.3em;
  margin: 10px 0;
}

.sq-question-label,
.sq-question-quote {
  font-weight: bold;
}

.sq-question-support-reference,
.sq-question-quote {
  margin-bottom: 10px;
}

.article {
  break-after: auto !important;
  orphans: 2;
  widows: 2;
}

hr {
  break-before: avoid !important;
}

.ta.appendex article {
  break-after: page !important;
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

.ta.appendex .article-body h1,
.article-body h2,
.article-body h3,
.article-body h4 {
  font-size: 1em;
}

.title-page {
  text-align: center;
}

.sq-question-body h4 ~ p,
.sq-question-body h4 ~ ul,
.sq-question-body h4 ~ ol {
  margin-left: 20px;
}

.sq-question-body h5 ~ p,
.sq-question-body h5 ~ ul,
.sq-question-body h5 ~ ol {
  margin-left: 40px;
}

.sq-question-body h6 ~ p,
.sq-question-body h6 ~ ul,
.sq-question-body h6 ~ ol {
  margin-left: 60px;
}

.sq-question-body h4 ~ h5 ~ h4 ~ p,
.sq-question-body h4 ~ h5 ~ h4 ~ ul,
.sq-question-body h4 ~ h5 ~ h4 ~ ol {
  margin-left: 40px;
}

.sq-question-body h5 ~ h6 ~ h5 ~ p,
.sq-question-body h5 ~ h6 ~ h5 ~ ul,
.sq-question-body h5 ~ h6 ~ h5 ~ ol {
  margin-left: 40px;
}

.sq-question-body h4 + * {
  margin-left: 20px !important;
}

.sq-question-body h5 + * {
  margin-left: 40px  !important;
}

.sq-question-body h6 + * {
  margin-left: 60px !important;
}

.sq-question-body h4 {
  margin-left: 10px !important;
  font-size: 1.2em !important;
}

.sq-question-body h5 {
  margin-left: 30px !important;
  font-size: 1.1em !important;
}

.sq-question-body h6 {
  margin-left: 50px !important;
  font-size: 1em !important;
}
`;

const requiredSubjects = ['Aligned Bible', 'Hebrew Old Testament', 'Greek New Testament'];
const quoteTokenDelimiter = ' … ';

export default function RcStudyQuestions() {
  const {
    state: { urlInfo, catalogEntry, expandedBooks, bookTitle, navAnchor, authToken, builtWith, renderOptions, supportedBooks, errorMessages, renderNewCopy },
    actions: { setBookTitle, setSupportedBooks, setStatusMessage, setErrorMessage, setHtmlSections, setNavAnchor, setCanChangeColumns, setBuiltWith, setIsDefaultBook },
  } = useContext(AppContext);

  const [html, setHtml] = useState();
  const [copyright, setCopyright] = useState();

  const renderFlags = {
    showWordAtts: false,
    showTitles: true,
    showHeadings: true,
    showIntroductions: true,
    showFootnotes: false,
    showXrefs: false,
    showParaStyles: true,
    showCharacterMarkup: false,
    showChapterLabels: true,
    showVersesLabels: true,
  };

  const onBibleReferenceChange = (b, c, v) => {
    if (b && !expandedBooks.includes(b)) {
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
    initialBook: expandedBooks[0] || catalogEntry?.ingredients?.[0]?.identifier || 'gen',
    initialChapter: parseInt(urlInfo.hashParts[1]) || 1,
    initialVerse: parseInt(urlInfo.hashParts[2]) || 1,
    onChange: onBibleReferenceChange,
  });

  const relationCatalogEntries = useFetchRelationCatalogEntries({
    catalogEntry,
    requiredSubjects,
  });

  const sourceBibleCatalogEntries = useFetchCatalogEntriesBySubject({
    catalogEntries: relationCatalogEntries,
    subject: BibleBookData[expandedBooks[0]]?.testament == 'old' ? 'Hebrew Old Testament' : 'Greek New Testament',
    bookId: expandedBooks[0],
    firstOnly: true,
  });

  const sourceUsfms = useFetchBookFiles({
    catalogEntries: sourceBibleCatalogEntries,
    bookId: expandedBooks[0],
    canFetch: renderNewCopy,
  });

  const targetBibleCatalogEntries = useFetchCatalogEntriesBySubject({
    catalogEntries: relationCatalogEntries,
    subject: 'Aligned Bible',
    bookId: expandedBooks[0],
  });

  const targetUsfms = useFetchBookFiles({
    catalogEntries: targetBibleCatalogEntries,
    bookId: expandedBooks[0],
    canFetch: renderNewCopy,
  });

  const catalogEntries = useMemo(() => (catalogEntry ? [catalogEntry] : []), [catalogEntry]);

  const sqTsvBookFiles = useFetchBookFiles({
    catalogEntries,
    bookId: expandedBooks[0],
    canFetch: renderNewCopy,
  });

  const sqTsvData = usePivotTsvFileOnReference({
    tsvBookFile: sqTsvBookFiles?.[0],
  });

  const sqTsvDataWithGLQuotes = useFetchGLQuotesForTsvData({
    tsvData: sqTsvData,
    sourceUsfm: sourceUsfms?.[0],
    targetUsfms,
    quoteTokenDelimiter,
  });

  useEffect(() => {
    if (navAnchor && !navAnchor.includes('--')) {
      const parts = navAnchor.split('-');
      if (bibleReferenceState.bookId == parts[0] && (bibleReferenceState.chapter != (parts[1] || '1') || bibleReferenceState.verse != (parts[2] || '1'))) {
        bibleReferenceActions.goToBookChapterVerse(parts[0], parts[1] || '1', parts[2] || '1');
      }
    }
  }, [navAnchor]);

  useEffect(() => {
    const setInitialBookIdAndSupportedBooks = async () => {
      let repoFileList = null;
      try {
        repoFileList = (await getRepoGitTrees(catalogEntry.repo.url, catalogEntry.branch_or_tag_name, authToken, false)).map((tree) => tree.path);
      } catch (e) {
        console.log(`Error calling getRepoGitTrees(${catalogEntry.repo.url}, ${catalogEntry.branch_or_tag_name}, false): `, e);
      }

      let sb = getSupportedBooks(catalogEntry, repoFileList);
      if (!sb.length) {
        setErrorMessage('There are no books in this resource to render.');
        return;
      }
      if (!sb.includes(expandedBooks[0])) {
        setErrorMessage(`This resource does not support the rendering of the book \`${expandedBooks[0]}\`. Please choose another book to render.`);
        sb = [expandedBooks[0], ...sb];
      }
      setSupportedBooks(sb);
      if (sb[0] === expandedBooks[0]) {
        setIsDefaultBook(true);
      }
      bibleReferenceActions.applyBooksFilter(sb);

      const title = catalogEntry.ingredients.filter((ingredient) => ingredient.identifier == expandedBooks[0]).map((ingredient) => ingredient.title)[0] || expandedBooks[0];
      setBookTitle(title);

      setStatusMessage(
        <>
          Preparing preview for {title}.
          <br />
          Please wait...
        </>
      );
    };

    if (catalogEntry && !supportedBooks.length && !errorMessages && expandedBooks.length) {
      setHtmlSections((prevState) => {
        return { ...prevState, css: { web: webCss, print: '' } };
      });
      setCanChangeColumns(false);
      setInitialBookIdAndSupportedBooks();
    }
  }, [urlInfo, catalogEntry, expandedBooks, errorMessages, supportedBooks, authToken, setCanChangeColumns, setErrorMessage, setHtmlSections, setStatusMessage, setBookTitle, setSupportedBooks, setIsDefaultBook]);

  useEffect(() => {
    if (
      catalogEntry &&
      sourceBibleCatalogEntries?.length &&
      targetBibleCatalogEntries?.length
    ) {
      setBuiltWith([
        catalogEntry,
        ...targetBibleCatalogEntries,
        ...(sourceBibleCatalogEntries?.[0] ? [sourceBibleCatalogEntries[0]] : []),
      ]);
    }
  }, [catalogEntry, sourceBibleCatalogEntries, targetBibleCatalogEntries, setBuiltWith]);

  useEffect(() => {
    const generateHtml = async () => {
      let html = `
<div class="section sq-book-section" id="nav-${expandedBooks[0]}" data-toc-title="${catalogEntry.title} - ${bookTitle}">
  <h1 class="header sq-book-section-header"><a href="#nav-${expandedBooks[0]}" class="header-link">${catalogEntry.title} - ${bookTitle}</a></h1>
`;
      let usfmJSONs = [];
      for (let targetUsfm of targetUsfms) {
        usfmJSONs.push(usfm.toJSON(targetUsfm));
      }

      if ((!renderOptions.chapters || renderOptions.chapters.includes('front')) && sqTsvDataWithGLQuotes?.['front']?.['intro']) {
        html += `
      <div id="nav-${expandedBooks[0]}-front-intro" class="section sq-front-intro-section" data-toc-title="${bookTitle} Introduciton">
`;
        for (let row of sqTsvDataWithGLQuotes['front']['intro']) {
          const link = `nav-${expandedBooks[0]}-front-intro-${row.ID}`;
          const article = `
        <div class="article sq-front-intro-question">
          <span class="header-title">${catalogEntry.title} :: ${bookTitle} :: Introduction</span>
          <div class="sq-question-body">
${convertNoteFromMD2HTML(row.Question, expandedBooks[0], 'front')}
          </div>
        </div>
`;
          html += article;
        }
        html += `
      </div>
`;
      }

      for (let chapterIdx = 0; chapterIdx < BibleBookData[expandedBooks[0]].chapters.length; chapterIdx++) {
        const numVerses = BibleBookData[expandedBooks[0]].chapters[chapterIdx];
        const chapterStr = String(chapterIdx + 1);
        if (renderOptions.chapters && !renderOptions.chapters.includes(chapterStr)) {
          continue;
        }
        html += `
      <div id="nav-${expandedBooks[0]}-${chapterStr}" class="section sq-chapter-section" data-toc-title="${bookTitle} ${chapterStr}">
        <h2 class="header sq-chapter-header"><a href="#nav-${expandedBooks[0]}-${chapterStr}" class="header-link">${bookTitle} ${chapterStr}</a></h2>
`;
        if (sqTsvDataWithGLQuotes?.[chapterStr]?.['intro']) {
          html += `
        <div class="section sq-chapter-intro-section">
`;
          for (let row of sqTsvDataWithGLQuotes[chapterStr]['intro']) {
            const link = `nav-${expandedBooks[0]}-${chapterStr}-intro-${row.ID}`;
            const article = `
          <div class="article sq-question-body" id="${link}">
            <span class="header-title">${catalogEntry.title} :: ${bookTitle} Introduction</span>
            ${convertNoteFromMD2HTML(row.Question, expandedBooks[0], chapterStr)}
          </div>
`;
            html += article;
          }
          html += `
        </div>
`;
        }

        for (let verseIdx = 0; verseIdx < numVerses; verseIdx++) {
          const verseStr = String(verseIdx + 1);
          const refStr = `${chapterStr}:${verseStr}`;
          const verseLink = `nav-${expandedBooks[0]}-${chapterStr}-${verseStr}`;
          let usfmJSONVerseStr = verseStr;
          html += `
        <div id="${verseLink}" class="section sq-chapter-verse-section">
          <h3 class="header sq-verse-header"><a href="#${verseLink}" class="header-link">${bookTitle} ${chapterStr}:${verseStr}</a></h3>
          <span class="header-title">${catalogEntry.title} :: ${bookTitle} ${chapterStr}:${verseStr}</span>
`;
          let scripture = {};
          for (let targetIdx in targetBibleCatalogEntries) {
            const targetBibleCatalogEntry = targetBibleCatalogEntries[targetIdx];
            if (!(chapterStr in (usfmJSONs[targetIdx]?.chapters || {}))) {
              continue;
            }
            if (!(verseStr in usfmJSONs[targetIdx].chapters[chapterStr])) {
              for (let v of Object.keys(usfmJSONs[targetIdx].chapters[chapterStr])) {
                if (v.includes('-') || v.includes(',')) {
                  let verses = [];
                  const seperateVerseSpans = v.split(',');
                  for (let span of seperateVerseSpans) {
                    span = span.trim();
                    if (span.includes('-')) {
                      const [start, end] = span.split('-').map(Number);
                      for (let i = start; i <= end; i++) {
                        verses.push(String(i));
                      }
                    } else {
                      verses.push(span);
                    }
                  }
                  if (verses.includes(verseStr)) {
                    usfmJSONVerseStr = v;
                  }
                }
              }
            }
            scripture[targetIdx] = verseObjectsToString(usfmJSONs[targetIdx]?.chapters[chapterStr]?.[usfmJSONVerseStr]?.verseObjects || []);
            const scriptureLink = `nav-${expandedBooks[0]}-${chapterStr}-${verseStr}-${targetBibleCatalogEntry.abbreviation}`;
            html += `
          <div class="article sq-scripture-block" id="${scriptureLink}">
            <h4 class="header sq-scripture-header">
              <a href="#${scriptureLink}" class="header-link">
                ${targetBibleCatalogEntry.abbreviation.toUpperCase()}:
              </a>
            </h4>
            <div class="sq-scripture-text">
              ${scripture[targetIdx]}${usfmJSONVerseStr != verseStr ? `(vv${usfmJSONVerseStr})` : ''}
            </div>
          </div>
`;
          }
          if (sqTsvDataWithGLQuotes?.[chapterStr]?.[verseStr]) {
            for (let rowIdx in sqTsvDataWithGLQuotes[chapterStr][verseStr]) {
              const row = sqTsvDataWithGLQuotes[chapterStr][verseStr][rowIdx];
              const questionLink = `nav-${expandedBooks[0]}-${chapterStr}-${verseStr}-${row.ID}`;
              let verseBridge = '';
              if (refStr != row.Reference) {
                verseBridge += `(${row.Reference})`;
              }
              let article = `
              <div class="article sq-question-article" id="nav-${questionLink}">
`;
              if (!row.Quote || row.Quote.endsWith(':')) {
                article += `
                <h4 class="header sq-question-header">
                  <a href="#nav-${questionLink}" class="header-link">
                  Question: ${verseBridge}
                  </a>
                </h4>
`;
              } else {
                for (let targetIdx in targetBibleCatalogEntries) {
                  const targetBibleCatalogEntry = targetBibleCatalogEntries[targetIdx];
                  const glQuoteCol = `GLQuote${targetIdx}`;
                  let quote = row[glQuoteCol]
                    ? insertUnmatchedCurlyBracesInQuote(row[glQuoteCol], scripture[targetIdx], quoteTokenDelimiter)
                    : row.Quote
                    ? `<span style="color: red">“${row.Quote}” (ORIG QUOTE)</span>`
                    : '';
                  let verseBridge = '';
                  if (refStr != row.Reference) {
                    verseBridge += `(${row.Reference})`;
                  }
                  article += `
                <h4 class="header sq-question-header">
                  <a href="#${questionLink}" class="header-link">
                  ${quote} ${verseBridge} (${targetBibleCatalogEntry.abbreviation.toUpperCase()})
                  </a>
                </h4>
`;
                }
              }

              if (row.Question) {
                article += `
              <div id="${questionLink}" class="tq-question-article">
                <div class="tq-entry">
                  <h4 class="tq-entry-question">
                    <a class="header-link" href="#${questionLink}">
                      ${row.Question} ${verseBridge}
                    </a>
                  </h4>
`;
                if (row.Response) {
                  article += `
                  <input type="checkbox" class="response-show-checkbox" id="checkbox-${row.ID}" style="display:none;">
                  <label class="response-show-label" for="checkbox-${row.ID}"></label>
                  <div class="tq-entry-response">
                    ${convertNoteFromMD2HTML(row.Response, expandedBooks[0], chapterStr)}
                  </div>
`;
                }
                article += `
                </div>
              </div>
`;
              }
              article += `
        <hr style="width: 75%"/>
      </div>
`;
              html += article;
            }
          } else {
            html += `
          <div class="article sq-verse-no-content">
            (There are no questions for this verse)
          </div>
`;
          }

          html += `
      <hr style="width: 100%"/>
    </div>
`;
        }
        html += `
  </div>
`;
      }

      html += `
</div>
`;
    }

    if (!html && targetBibleCatalogEntries && sqTsvDataWithGLQuotes && targetUsfms?.length) {
      generateHtml();
    }
  }, [
    catalogEntry,
    html,
    expandedBooks,
    bookTitle,
    targetBibleCatalogEntries,
    sqTsvDataWithGLQuotes,
    targetUsfms,
    renderOptions,
    setHtmlSections,
    setErrorMessage,
    setNavAnchor,
  ]);

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
    if (html && copyright) {
      setHtmlSections((prevState) => ({
        ...prevState,
        cover: `<h3>${bookTitle}</h3>` + (renderOptions.chaptersOrigStr ? `<h4>Chapters: ${renderOptions.chaptersOrigStr}</h4>` : ''),
        copyright,
        body: html,
      }));
      setStatusMessage('');
    }
  }, [html, copyright, bookTitle, renderOptions, setHtmlSections, setStatusMessage]);

  return <BibleReference status={bibleReferenceState} actions={bibleReferenceActions} style={{ minWidth: 'auto' }} />;
}
