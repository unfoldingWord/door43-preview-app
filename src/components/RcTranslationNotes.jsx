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
import useFetchZipFileData from '@hooks/useFetchZipFileData';
import usePivotTsvFileOnReference from '@hooks/usePivotTsvFileOnReference';
import useFetchGLQuotesForTsvData from '@hooks/useFetchGLQuotesForTsvData';
import useGenerateTranslationAcademyFileContents from '@hooks/useGenerateTranslationAcademyFileContents';
import useGenerateTranslationWordsFileContents from '@hooks/useGenerateTranslationWordsFileContents';

// Other imports
import usfm from 'usfm-js';
import { verseObjectsToString } from 'uw-quote-helpers';
import { insertUnmatchedCurlyBracesInQuote } from '@helpers/quotes';
import { generateCopyrightAndLicenseHTML } from '@helpers/html';

// Context imports
import { AppContext } from '@components/App.context';

const webCss = `
.tn-book-section-header {
  break-after: avoid !important;
}

.tn-scripture-block {
  border: 1px solid black;
  padding: 10px;
  margin-bottom: 10px;
}

.tn-scripture-header {
  margin: 0;
}

.tn-scripture-text {
  font-style: italic;
}

.tn-note-body h3 {
  font-size: 1.3em;
  margin: 10px 0;
}

.tn-note-body h4 {
  font-size: 1.2em;
  margin: 10px 0;
}

.tn-note-body h5 {
  font-size: 1.1em;
  margin: 10px 0;
}

.tn-note-body h6 {
  font-size: 1em;
  margin: 10px 0;
}

.tn-note-label,
.tn-note-quote {
  font-weight: bold;
}

.tn-note-support-reference,
.tn-note-quote {
  margin-bottom: 10px;
}

.section {
  break-after: page !important;
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

.tn-verse-twl-bible {
  margin-bottom: 0;
}

.tn-verse-twl-list {
  margin: 0;
}

.tn-verse-twl-list-item a {
  text-decoration: none;
}
`;

const requiredSubjects = ['Aligned Bible', 'Translation Academy', 'Translation Words', 'TSV Translation Words Links', 'Hebrew Old Testament', 'Greek New Testament'];
const quoteTokenDelimiter = ' … ';

export default function RcTranslationNotes() {
  const {
    state: { urlInfo, catalogEntry, bookId, lastBookId, bookTitle, navAnchor, authToken, builtWith, renderOptions },
    actions: { setBookId, setBookTitle, setSupportedBooks, setStatusMessage, setErrorMessage, setHtmlSections, setNavAnchor, setCanChangeColumns, setBuiltWith, setLastBookId, },
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
    if (b != (bookId || urlInfo.hashParts[0] || lastBookId || 'gen')) {
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
    initialBook: bookId || urlInfo.hashParts[0] || lastBookId || 'gen',
    initialChapter: urlInfo.hashParts[1] || '1',
    initialVerse: urlInfo.hashParts[2] || '1',
    onChange: onBibleReferenceChange,
  });

  const relationCatalogEntries = useFetchRelationCatalogEntries({
    catalogEntry,
    requiredSubjects,
    setErrorMessage,
    bookId,
    authToken,
  });

  const sourceBibleCatalogEntries = useFetchCatalogEntriesBySubject({
    catalogEntries: relationCatalogEntries,
    subject: BibleBookData[bookId]?.testament == 'old' ? 'Hebrew Old Testament' : 'Greek New Testament',
    bookId,
    firstOnly: true,
    setErrorMessage,
  });

  const sourceUsfms = useFetchBookFiles({
    catalogEntries: sourceBibleCatalogEntries,
    bookId,
    setErrorMessage,
  });

  const targetBibleCatalogEntries = useFetchCatalogEntriesBySubject({
    catalogEntries: relationCatalogEntries,
    subject: 'Aligned Bible',
    bookId,
    setErrorMessage,
  });

  const targetUsfms = useFetchBookFiles({
    catalogEntries: targetBibleCatalogEntries,
    bookId,
    setErrorMessage,
  });

  const catalogEntries = useMemo(() => (catalogEntry ? [catalogEntry] : []), [catalogEntry]);

  const tnTsvBookFiles = useFetchBookFiles({
    catalogEntries,
    bookId,
    setErrorMessage,
  });

  const tnTsvData = usePivotTsvFileOnReference({
    tsvBookFile: tnTsvBookFiles?.[0],
  });

  const tnTsvDataWithGLQuotes = useFetchGLQuotesForTsvData({
    tsvData: tnTsvData,
    sourceUsfm: sourceUsfms?.[0],
    targetUsfms,
    quoteTokenDelimiter,
  });

  const taCatalogEntries = useFetchCatalogEntriesBySubject({
    catalogEntries: relationCatalogEntries,
    subject: 'Translation Academy',
    firstOnly: true,
    setErrorMessage,
  });

  const taZipFileData = useFetchZipFileData({
    authToken,
    catalogEntry: taCatalogEntries?.[0],
  });

  const taFileContents = useGenerateTranslationAcademyFileContents({
    catalogEntry: taCatalogEntries[0],
    zipFileData: taZipFileData,
    setErrorMessage,
  });

  const twCatalogEntries = useFetchCatalogEntriesBySubject({
    catalogEntries: relationCatalogEntries,
    subject: 'Translation Words',
    firstOnly: true,
    setErrorMessage,
  });

  const twZipFileData = useFetchZipFileData({
    authToken,
    catalogEntry: twCatalogEntries?.[0],
  });

  const twFileContents = useGenerateTranslationWordsFileContents({
    catalogEntry: twCatalogEntries?.[0],
    zipFileData: twZipFileData,
    setErrorMessage,
  });

  const twlCatalogEntries = useFetchCatalogEntriesBySubject({
    catalogEntries: relationCatalogEntries,
    subject: 'TSV Translation Words Links',
    firstOnly: true,
    setErrorMessage,
  });

  const twlTSVBookFiles = useFetchBookFiles({
    catalogEntries: twlCatalogEntries,
    bookId,
    setErrorMessage,
  });

  const twlTsvData = usePivotTsvFileOnReference({
    tsvBookFile: twlTSVBookFiles?.[0],
  });

  const twlTsvDataWithGLQuotes = useFetchGLQuotesForTsvData({
    tsvData: twlTsvData,
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
    if (catalogEntry &&
      sourceBibleCatalogEntries?.length &&
      targetBibleCatalogEntries?.length &&
      taCatalogEntries?.length &&
      twCatalogEntries?.length &&
      twlCatalogEntries?.length
    ) {
      setBuiltWith([
        catalogEntry,
        ...targetBibleCatalogEntries,
        ...(sourceBibleCatalogEntries?.[0] ? [sourceBibleCatalogEntries[0]] : []),
        ...(taCatalogEntries?.[0] ? [taCatalogEntries[0]] : []),
        ...(twCatalogEntries?.[0] ? [twCatalogEntries[0]] : []),
        ...(twlCatalogEntries?.[0] ? [twlCatalogEntries[0]] : []),
      ]);
    }
  }, [catalogEntry, sourceBibleCatalogEntries, targetBibleCatalogEntries, taCatalogEntries, twCatalogEntries, twlCatalogEntries, setBuiltWith]);

  useEffect(() => {
    const setInitialBookIdAndSupportedBooks = async () => {
      if (!catalogEntry) {
        // setErrorMessage('No catalog entry for this resource found.');
        return;
      }

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
    };

    setHtmlSections((prevState) => {
      return { ...prevState, css: { web: webCss, print: '' } };
    });
    setCanChangeColumns(false);
    setInitialBookIdAndSupportedBooks();
  }, [urlInfo, catalogEntry, authToken, setCanChangeColumns, setErrorMessage, setBookId, setHtmlSections, setStatusMessage, setBookTitle, setSupportedBooks]);

  useEffect(() => {
    const searchForRcLinks = (data, article, referenceWithLink = '') => {
      const rcLinkRegex = /rc:\/\/[^/]+\/([^/]+)\/[^/]+\/([A-Za-z0-9/_-]+)/g;
      let match;
      while ((match = rcLinkRegex.exec(article)) !== null) {
        const [rcLink, resource, file] = match;
        if (!data[resource]) {
          data[resource] = {};
        }
        if (!data[resource][rcLink]) {
          data[resource][rcLink] = {
            backRefs: [],
            title: file,
            body: `${resource.toUpperCase()} ARTICLE NOT FOUND`,
            rcLink,
            anchor: `nav-${bookId}--${resource}-${file.replace(/\//g, '-')}`,
          };
          const fileParts = file.split('/');
          switch (resource) {
            case 'ta':
              {
                const manualId = fileParts[0];
                const articleId = fileParts.slice(1).join('/');
                data[resource][rcLink].title = taFileContents?.[manualId]?.articles?.[articleId]?.title || `TA ARTICLE FOR ${manualId} :: ${articleId} NOT FOUND!`;
                data[resource][rcLink].body = taFileContents?.[manualId]?.articles?.[articleId]?.body || '';
              }
              break;
            case 'tw':
              {
                const category = fileParts[1];
                const articleId = fileParts.slice(2).join('/');
                data[resource][rcLink].title = twFileContents?.[category]?.articles?.[articleId]?.title || `TW ARTICLE FOR ${category} :: ${articleId} NOT FOUND!`;
                data[resource][rcLink].body = twFileContents?.[category]?.articles[articleId]?.body || '';
              }
              break;
          }
        }
        if (referenceWithLink && !data[resource][rcLink].backRefs.includes(referenceWithLink)) {
          data[resource][rcLink].backRefs.push(referenceWithLink);
        }
      }
      return data;
    };

    const generateHtml = async () => {
      let html = `
<div class="section tn-book-section" id="nav-${bookId}" data-toc-title="${catalogEntry.title} - ${bookTitle}">
  <h1 class="header tn-book-section-header"><a href="#nav-${bookId}" class="header-link">${catalogEntry.title} - ${bookTitle}</a></h1>
`;
      let usfmJSONs = [];
      for (let targetUsfm of targetUsfms) {
        usfmJSONs.push(usfm.toJSON(targetUsfm));
      }
      const rcLinksData = {};

      if ((! renderOptions.chapters || renderOptions.chapters.includes('front')) && tnTsvDataWithGLQuotes?.['front']?.['intro']) {
        html += `
      <div class="section tn-front-intro-section" data-toc-title="${bookTitle} Introduciton">
`;
        for (let row of tnTsvDataWithGLQuotes['front']['intro'])
          html += `
        <div class="article tn-front-intro-note">
          <span class="header-title">${catalogEntry.title} :: ${bookTitle} :: Introduction</span>
          <div class="tn-note-body">
${convertNoteFromMD2HTML(row.Note, bookId, 'front')}
          </div>
        </div>
`;
        html += `
      </div>
`;
      }

      for (let chapterIdx = 0; chapterIdx < BibleBookData[bookId].chapters.length; chapterIdx++) {
        const numVerses = BibleBookData[bookId].chapters[chapterIdx];
        const chapterStr = String(chapterIdx + 1);
        if (renderOptions.chapters && !renderOptions.chapters.includes(chapterStr)) {
          continue;
        }
        html += `
      <div id="nav-${bookId}-${chapterStr}" class="section tn-chapter-section" data-toc-title="${bookTitle} ${chapterStr}">
        <h2 class="header tn-chapter-header"><a href="#nav-${bookId}-${chapterStr}" class="header-link">${bookTitle} ${chapterStr}</a></h2>
`;
        if (tnTsvDataWithGLQuotes?.[chapterStr]?.['intro']) {
          html += `
        <div class="section tn-chapter-intro-section">
`;
          for (let row of tnTsvDataWithGLQuotes[chapterStr]['intro']) {
            const link = `nav-${bookId}-${chapterStr}-intro-${row.ID}`;
            const article = `
          <div class="article" id="${link}">
            <span class="header-title">${catalogEntry.title} :: ${bookTitle} Introduction</span>
            ${convertNoteFromMD2HTML(row.Note, bookId, chapterStr)}
          </div>
`;
            searchForRcLinks(rcLinksData, article, `<a href="#${link}">${row.Reference}</a>`);
            html += article;
          }
          html += `
        </div>
`;
        }

        for (let verseIdx = 0; verseIdx < numVerses; verseIdx++) {
          const verseStr = String(verseIdx + 1);
          const refStr = `${chapterStr}:${verseStr}`;
          const verseLink = `nav-${bookId}-${chapterStr}-${verseStr}`;
          let usfmJSONVerseStr = verseStr;
          html += `
        <div id="${verseLink}" class="section tn-chapter-verse-section">
          <h3 class="header tn-verse-header"><a href="#${verseLink}" class="header-link">${bookTitle} ${chapterStr}:${verseStr}</a></h3>
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
            const scriptureLink = `nav-${bookId}-${chapterStr}-${verseStr}-${targetBibleCatalogEntry.abbreviation}`;
            html += `
          <div class="article tn-scripture-block" id="${scriptureLink}">
            <h4 class="header tn-scripture-header">
              <a href="#${scriptureLink}" class="header-link">
                ${targetBibleCatalogEntry.abbreviation.toUpperCase()}:
              </a>
            </h4>
            <div class="tn-scripture-text">
              ${scripture[targetIdx]}${usfmJSONVerseStr != verseStr ? `(vv${usfmJSONVerseStr})` : ''}
            </div>
          </div>
`;
          }
          if (tnTsvDataWithGLQuotes?.[chapterStr]?.[verseStr]) {
            for (let rowIdx in tnTsvDataWithGLQuotes[chapterStr][verseStr]) {
              const row = tnTsvDataWithGLQuotes[chapterStr][verseStr][rowIdx];
              const noteLink = `nav-${bookId}-${chapterStr}-${verseStr}-${row.ID}`;
              let verseBridge = '';
              if (refStr != row.Reference) {
                verseBridge += `(${row.Reference})`;
              }
              let article = `
              <div class="article tn-note-article" id="nav-${noteLink}">
`;
              if (!row.Quote) {
                article += `
                <h4 class="header tn-note-header">
                  <a href="#nav-${noteLink}" class="header-link">
                  Note: ${verseBridge}
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
                <h4 class="header tn-note-header">
                  <a href="#${noteLink}" class="header-link">
                  ${quote} ${verseBridge} (${targetBibleCatalogEntry.abbreviation.toUpperCase()})
                  </a>
                </h4>
`;
                }
              }
              article += `
              <span class="header-title">${catalogEntry.title} :: ${bookTitle} ${row.Reference}</span>
              <div class="tn-note-body">
                ${convertNoteFromMD2HTML(row.Note, bookId, chapterStr)}
              </div>
`;
              if (row.SupportReference) {
                article += `
          <div class="tn-note-support-reference">
            <span class="tn-note-label">Support Reference:&nbsp;</span>
              [[${row.SupportReference}]]
          </div>
`;
              }
              article += `
        <hr style="width: 75%"/>
      </div>
`;
              html += article;
              searchForRcLinks(rcLinksData, article, `<a href="#${noteLink}">${row.Reference}</a>`);
            }
          } else {
            html += `
          <div class="article tn-verse-no-content">
            (There are no notes for this verse)
          </div>
`;
          }

          // TW LINKS
          if (twlTsvDataWithGLQuotes?.[chapterStr]?.[verseStr]) {
            const twlLink = `twl-${bookId}-${chapterStr}-${verseStr}`;
            let article = `
          <div class="article tn-verse-twls" id="${twlLink}">
            <h4 class="header tn-verse-twl-header">${twCatalogEntries?.[0].title}</h4>
`;
            for (let targetidx in targetBibleCatalogEntries) {
              const targetBibleCatalogEntry = targetBibleCatalogEntries[targetidx];
              const glQuoteCol = `GLQuote${targetidx}`;
              article += `
            <h5 class="tn-verse-twl-bible">${targetBibleCatalogEntry.abbreviation.toUpperCase()}</h4>
            <ul class="tn-verse-twl-list">
`;
              for (let row of twlTsvDataWithGLQuotes[chapterStr][verseStr]) {
                let glQuote = row[glQuoteCol];
                glQuote = glQuote ? insertUnmatchedCurlyBracesInQuote(row[glQuoteCol], scripture[targetidx], quoteTokenDelimiter) : row.Quote + ' (ORIG QUOTE)';
                article += `
                <li class="tn-verse-twl-list-item"><a href="${row.TWLink}">${glQuote}</a></li>
`;
              }
              article += `
            </ul>
`;
            }
            article += `
          </div>
`;
            html += article;
            searchForRcLinks(rcLinksData, article, `<a href="#${verseLink}">${chapterStr}:${verseStr}</a>`);
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
      if (rcLinksData.ta && taCatalogEntries.length) {
        const taCatalogEntry = taCatalogEntries[0];
        // TA ARTICLES
        html += `
<div class="appendex ta section" id="appendex-ta" data-toc-title="Appendex: ${encodeHTML(taCatalogEntry.title)}">
  <div class="article title-page">
    <span class="header-title"></span>
    <img class="title-logo" src="https://cdn.door43.org/assets/uw-icons/logo-uta-256.png" alt="uta">
    <h1 class="header cover-header section-header">${taCatalogEntry.title} - ${bookTitle}</h1>
    <h3 class="cover-version">${taCatalogEntry.branch_or_tag_name}</h3>
  </div>
`;
        Object.values(rcLinksData.ta)
          .sort((a, b) => (a.title.toLowerCase() < b.title.toLowerCase() ? -1 : a.title.toLowerCase() > b.title.toLowerCase() ? 1 : 0))
          .forEach((taArticle) => {
            const article = `
  <div class="article" id="${taArticle.anchor}" data-toc-title="${encodeHTML(taArticle.title)}">
    <h2 class="header article-header">
      <a href="#${taArticle.anchor}" class="header-link">${taArticle.title}</a>
    </h2>
    <span class="header-title">${taCatalogEntry.title} :: ${taArticle.title}</span>
    <div class="article-body">
      ${taArticle.body}
    </div>
    <div class="back-refs">
      <h3>${bookTitle} References:</h3>
      ${taArticle.backRefs.join('; ')}
    </div>
  </div>
`;
            html += article;
            searchForRcLinks(rcLinksData, article);
          });
        html += `
</div>
`;
      }
      if (rcLinksData.tw && twCatalogEntries.length) {
        const twCatalogEntry = twCatalogEntries[0];
        // TW ARTICLES
        html += `
<div class="appendex tw section" id="appendex-tw" data-toc-title="Appendex: ${encodeHTML(twCatalogEntry.title)}">
  <div class="article title-page">
    <span class="header-title"></span>
    <img class="title-logo" src="https://cdn.door43.org/assets/uw-icons/logo-utw-256.png" alt="uta">
    <h1 class="header cover-header section-header">${twCatalogEntry.title} - ${bookTitle}</h1>
    <h3 class="cover-version">${twCatalogEntry.branch_or_tag_name}</h3>
  </div>
`;
        Object.values(rcLinksData.tw)
          .sort((a, b) => (a.title.toLowerCase() < b.title.toLowerCase() ? -1 : a.title.toLowerCase() > b.title.toLowerCase() ? 1 : 0))
          .forEach((twArticle) => {
            const article = `
  <div class="article" id="${twArticle.anchor}" data-toc-title="${encodeHTML(twArticle.title)}">
    <h2 class="header article-header">
      <a href="#${twArticle.anchor}" class="header-link">${twArticle.title}</a>
    </h2>
    <span class="header-title">${twCatalogEntry.title} :: ${twArticle.title}</span>
    <div class="article-body">
      ${twArticle.body}
    </div>
    <div class="back-refs">
      <h3>${bookTitle} References:</h3>
      ${twArticle.backRefs.join('; ')}
    </div>
  </div>
`;
            html += article;
            searchForRcLinks(rcLinksData, article);
          });
        html += `
</div>
`;
      }

      for (let data of Object.values(rcLinksData.ta || {})) {
        let regex = new RegExp(`href="#*${data.rcLink.replace(/rc:\/\/[^/]+\//, 'rc://[^/]+/')}"`, 'g');
        html = html.replace(regex, `href="#${data.anchor}"`);
        regex = new RegExp(`\\[+${data.rcLink.replace(/rc:\/\/[^/]+\//, 'rc://[^/]+/')}\\]+`, 'g');
        html = html.replace(regex, `<a href="#${data.anchor}">${data.title}</a>`);
      }
      for (let data of Object.values(rcLinksData.tw || {})) {
        let regex = new RegExp(`href="#*${data.rcLink.replace(/rc:\/\/[^/]+\//, 'rc://[^/]+/')}"`, 'g');
        html = html.replace(regex, `href="#${data.anchor}"`);
        regex = new RegExp(`\\[+${data.rcLink.replace(/rc:\/\/[^/]+\//, 'rc://[^/]+/')}\\]+`, 'g');
        html = html.replace(regex, `<a href="${data.anchor}">${data.title}</a>`);
      }
      setHtml(html);
    };

    if (!html && targetBibleCatalogEntries && tnTsvDataWithGLQuotes && targetUsfms?.length && twlTsvDataWithGLQuotes && taFileContents && twFileContents) {
      generateHtml();
    }
  }, [
    catalogEntry,
    html,
    taCatalogEntries,
    bookId,
    bookTitle,
    targetBibleCatalogEntries,
    tnTsvDataWithGLQuotes,
    targetUsfms,
    taFileContents,
    twCatalogEntries,
    twFileContents,
    twlTsvDataWithGLQuotes,
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

    if (catalogEntry && builtWith.length) {
      generateCopyrightPage();
    }
  }, [catalogEntry, builtWith, authToken, setCopyright]);

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
