// React imports
import { useState, useEffect, useContext, useMemo } from 'react';

// Bible reference imports
import BibleReference, {useBibleReference} from 'bible-reference-rcl';
import { BibleBookData } from '@common/books';

// Context imports
import { AppContext } from '@components/App.context';

// Hook imports
import useFetchRelationCatalogEntries from '@hooks/useFetchRelationCatalogEntries';
import useFetchCatalogEntriesBySubject from '@hooks/useFetchCatalogEntriesBySubject';
import usePivotTsvFileOnReference from '@hooks/usePivotTsvFileOnReference';
import useFetchBookFiles from '@hooks/useFetchBookFiles';

// Helper imports
import { getSupportedBooks } from '@helpers/books';
import { getRepoContentsContent, getRepoGitTrees } from '@helpers/dcsApi';
import { verseObjectsToString } from 'uw-quote-helpers';
import { convertNoteFromMD2HTML } from '@helpers/html';

// Library imports
import usfm from 'usfm-js';
import MarkdownIt from 'markdown-it';

const webCss = `
.tq-question {
  font-weight: bold;
}

.tq-entry h1 {
  font-size: 1.4em;
  margin: 10px 0;
}

.tq-entry h2 {
  font-size: 1.2em;
  margin: 10px 0;
}

.tq-entry h3, .tq-entry h4 {
  font-size: 1.1em;
  margin: 10px 0;
}

article.tq-scripture,
article.tq-entry,
section.tq-verse {
  break-before: auto !important;
  break-inside: avoid !important;
  break-after: auto !important
}

section.book-chapter {
  break-after: page !important;
}

a.header-link {
  font-weight: inherit !important;
  font-size: inherit !important;
  color: #000000;
  text-decoration: none;
}

a.header-link:hover::after {
  content: "#";
  padding-left: 5px;
  color: blue;
  display: inline-block;
}

.tq-entry {
  margin-left: 30px;
}

#web-preview h4.tq-entry-question {
  display:inline-block;
}

#web-preview label.response-show-label {
  margin-left: 20px;
  display: inline-box;
}

.response-show-checkbox {
  display: none;
}

#web-preview .response-show-checkbox ~ div.tq-entry-response {
  display: none;
  clear: both;
  margin-bottom: 20px;
}

#web-preview .response-show-checkbox:checked ~ div.tq-entry-response {
  display: block;
}

#web-preview label.response-show-label::after {
  background-color: white;
  border-right: 3px solid black;
  border-bottom: 3px solid black;
  width: 10px;
  display: inline-block;
  height: 10px;
  transform: rotate(45deg);
  -webkit-transform: scale(1) rotate(45deg) translate(0px, 0px);
  -moz-transform: rotate(45deg) scale(1.0);
  -o-transform: rotate(45deg) scale(1.0);
  margin-top: 10px;
  content: "";
  margin-left: 5px;
}

#web-preview .response-show-checkbox:checked ~ label.response-show-label::after {
  border-right: 3px solid black;
  border-bottom: 3px solid black;
  transform: rotate(-135deg);
  -webkit-transform: scale(1) rotate(-135deg) translate(0px, 0px);
  -moz-transform: rotate(-135deg) scale(1.0);
  -o-transform: rotate(-135deg) scale(1.0);
}

.tq-scripture-block {
  border: 1px solid black;
  padding: 10px;
  margin-bottom: 10px;
}

.tq-scripture-header {
  margin: 0;
}

.tq-scripture-text {
  font-style: italic;
}

.tq-chapter-section {
  break-after: page !important;
}

.tq-chapter-section * {
  break-inside: avoid !important;
}

`;

export default function RcTranslationQuestions() {
  const {
    state: { urlInfo, catalogEntry, documentAnchor },
    actions: { setWebCss, setStatusMessage, setErrorMessage, setHtmlSections, setDocumentAnchor, setCanChangeColumns },
  } = useContext(AppContext);

  const [bookId, setBookId] = useState();
  const [bookTitle, setBookTitle] = useState();
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
    if (bookId && b != bookId) {
      window.location.hash = b;
      window.location.reload();
    } else {
      setDocumentAnchor(`${b}-${c}-${v}`);
    }
  };

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: bookId || urlInfo.hashParts[0] || 'gen',
    initialChapter: urlInfo.hashParts[1] || '1',
    initialVerse: urlInfo.hashParts[2] || '1',
    onChange: onBibleReferenceChange,
  });

  const catalogEntries = useMemo(() => [catalogEntry], [catalogEntry]);

  const relationCatalogEntries = useFetchRelationCatalogEntries({
    catalogEntry,
  });

  const targetBibleCatalogEntries = useFetchCatalogEntriesBySubject({
    catalogEntries: relationCatalogEntries,
    subject: 'Aligned Bible',
    bookId,
  });

  const targetUsfmBookFiles = useFetchBookFiles({
    catalogEntries: targetBibleCatalogEntries,
    bookId,
  });

  const tqTsvBookFiles = useFetchBookFiles({
    catalogEntries,
    bookId,
  });

  const tqTsvData = usePivotTsvFileOnReference({
    tsvBookFile: tqTsvBookFiles?.[0],
  });

  useEffect(() => {
    const setInitialBookIdAndSupportedBooks = async () => {
      if (!catalogEntry) {
        setErrorMessage('No catalog entry for this resource found.');
        return;
      }

      let repoFileList = null;
      try {
        repoFileList = (await getRepoGitTrees(catalogEntry.repo.url, catalogEntry.branch_or_tag_name, false)).tree.map((tree) => tree.path);
      } catch (e) {
        console.log(`Error calling getRepoGitTrees(${catalogEntry.repo.url}, ${catalogEntry.branch_or_tag_name}, false): `, e);
      }

      let supportedBooks = getSupportedBooks(catalogEntry, repoFileList);
      if (!supportedBooks.length) {
        setErrorMessage('There are no books in this resource to render.');
        return;
      }
      bibleReferenceActions.applyBooksFilter(supportedBooks);

      let _bookId = urlInfo.hashParts[0] || supportedBooks[0];
      if (!_bookId) {
        setErrorMessage('Unable to determine a book ID to render.');
        return;
      }
      const title = catalogEntry.ingredients.filter((ingredient) => ingredient.identifier == _bookId).map((ingredient) => ingredient.title)[0] || _bookId;
      setBookId(_bookId);
      setBookTitle(title);
      setWebCss(webCss);
      setCanChangeColumns(false);
      setStatusMessage(
        <>
          Preparing preview for {title}.<br />
          Please wait...
        </>
      );
      if (!supportedBooks.includes(_bookId)) {
        setErrorMessage(`This resource does not support the rendering of the book \`${_bookId}\`. Please choose another book to render.`);
        supportedBooks = [_bookId, ...supportedBooks];
      }
    };

    setInitialBookIdAndSupportedBooks();
  }, [urlInfo, catalogEntry, setCanChangeColumns, setErrorMessage, setBookId, setWebCss, setStatusMessage, setBookTitle]);

  useEffect(() => {
    if (documentAnchor && documentAnchor.split('-').length) {
      const parts = documentAnchor.split('-');
      if (bibleReferenceState.bookId == parts[0] && (bibleReferenceState.chapter != (parts[1] || '1') || bibleReferenceState.verse != (parts[2] || '1'))) {
        bibleReferenceActions.goToBookChapterVerse(parts[0], parts[1] || '1', parts[2] || '1');
      }
    }
  }, [documentAnchor]);

  useEffect(() => {
    const generateHtml = async () => {
      let html = `
<div class="section tq-book-section" id="hash-${bookId}" data-toc-title="${catalogEntry.title} - ${bookTitle}">
  <h1 class="header tq-book-section-header"><a href="#hash-${bookId}" class="header-link">${bookTitle}</a></h1>
`;
      let usfmJSONs = [];
      for (let targetUsfm of targetUsfmBookFiles) {
        usfmJSONs.push(usfm.toJSON(targetUsfm));
      }
      if (tqTsvData?.front?.intro) {
        html += `
      <div class="section tq-front-intro-section" data-toc-title="${bookTitle} Introduciton">
`;
        for (let row of tqTsvData?.front?.intro || []) {
          html += `
        <div class="tq-front-intro-note">
          <span class="header-title">${catalogEntry.title} :: ${bookTitle} :: Introduction</span>
          <div class="tq-question-body">
            ${convertNoteFromMD2HTML(row.Question, bookId, 'front')}
            ${convertNoteFromMD2HTML(row.Response, bookId, 'front')}
          </div>
        </div>
`;
        }
      html += `
      </div>
`;
      }
      for (let chapterIdx = 0; chapterIdx < BibleBookData[bookId].chapters.length; chapterIdx++) {
        const numVerses = BibleBookData[bookId].chapters[chapterIdx];
        const chapterStr = String(chapterIdx + 1);
        html += `
      <div id="hash-${bookId}-${chapterStr}" class="section tq-chapter-section" data-toc-title="${bookTitle} ${chapterStr}">
        <h2 class="tq-chapter-header"><a href="#hash-${bookId}-${chapterStr}" class="header-link">${bookTitle} ${chapterStr}</a></h2>
`;
        if (tqTsvData?.[chapterStr]?.intro) {
          html += `
        <div class="section tq-chapter-intro-section">
`;
          for (let row of tqTsvData[chapterStr].intro) {
            const link = `hash-${bookId}-${chapterStr}-intro-${row.ID}`;
            const article = `
          <div id="${link}">
            <span class="header-title">${catalogEntry.title} :: ${bookTitle} Introduction</span>
            ${convertNoteFromMD2HTML(row.Question, bookId, chapterStr)}
            ${convertNoteFromMD2HTML(row.Response, bookId, chapterStr)}
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
          const verseLink = `hash-${bookId}-${chapterStr}-${verseStr}`;
          let usfmJSONVerseStr = verseStr;
          html += `
        <div id="${verseLink}" class="section tq-chapter-verse-section">
          <h3 class="tq-verse-header"><a href="#hash-${bookId}-${chapterStr}-${verseStr}" class="header-link">${bookTitle} ${chapterStr}:${verseStr}</a></h3>
          <span class="header-title">${catalogEntry.title} :: ${bookTitle} ${chapterStr}:${verseStr}</span>
`;
          let scripture = {};
          for (let targetIdx in targetBibleCatalogEntries) {
            const targetBibleCatalogEntry = targetBibleCatalogEntries[targetIdx];
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
            scripture[targetIdx] = verseObjectsToString(usfmJSONs[targetIdx].chapters[chapterStr][usfmJSONVerseStr].verseObjects);
            const scriptureLink = `hash-${bookId}-${chapterStr}-${verseStr}-${targetBibleCatalogEntry.abbreviation}`;
            html += `
          <div class="tq-scripture-block" id="${scriptureLink}">
            <h4 class="tq-scripture-header">
              <a href="#hash-${scriptureLink}" class="header-link">
                ${targetBibleCatalogEntry.abbreviation.toUpperCase()}:
              </a>
            </h4>
            <div class="tq-scripture-text">
              ${scripture[targetIdx]}${usfmJSONVerseStr != verseStr ? `(vv${usfmJSONVerseStr})` : ''}
            </div>
          </div>
`;
          }
          if (tqTsvData?.[chapterStr]?.[verseStr]) {
            for (let rowIdx in tqTsvData[chapterStr][verseStr]) {
              const row = tqTsvData[chapterStr][verseStr][rowIdx];
              const questionLink = `hash-${bookId}-${chapterStr}-${verseStr}-${row.ID}`;
              let verseBridge = '';
              if (refStr != row.Reference) {
                verseBridge += `(${row.Reference})`;
              }
              if (row.Question) {
                let article = `
              <div id="${questionLink}" class="tq-question-article">
                <div class="tq-entry" id="${questionLink}">
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
                    ${convertNoteFromMD2HTML(row.Response, bookId, chapterStr)}
                  </div>
`;
                }
                article += `
                </div>
              </div>
`;
                html += article;
              }
            }
          } else {
            html += `
          <div class="tq-verse-no-content">
            (There are no questions for this verse)
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

      html += `
</div>
`;
      setHtml(html);
    };

    if (targetBibleCatalogEntries?.length && Object.keys(tqTsvData).length && targetUsfmBookFiles?.length) {
      generateHtml();
    }
  }, [
    catalogEntry,
    targetBibleCatalogEntries,
    tqTsvBookFiles,
    targetUsfmBookFiles,
    bookId,
    bookTitle,
    setHtmlSections,
    setStatusMessage,
    setErrorMessage,
    setBookTitle,
    setDocumentAnchor,
  ]);

  useEffect(() => {
    const generateCopyrightPage = async () => {
      const entries = [catalogEntry, ...targetBibleCatalogEntries];

      let copyrightAndLicense = `<h1>Copyright s and Licenceing</h1>`;
      for (let entry of entries) {
        const date = new Date(entry.released);
        const formattedDate = date.toISOString().split('T')[0];
        copyrightAndLicense += `
    <div style="padding-bottom: 10px">
      <div style="font-weight: bold">${entry.title}</div>
      <div><span style="font-weight: bold">Date:</span> ${formattedDate}</div>
      <div><span style="font-weight: bold">Version:</span> ${entry.branch_or_tag_name}</div>
      <div><span style="font-weight: bold">Published by:</span> ${entry.repo.owner.full_name || entry.repo.owner}</div>
    </div>
`;
      }

      const md = new MarkdownIt();
      try {
        copyrightAndLicense += `<div class="license">` + md.render(await getRepoContentsContent(catalogEntry.repo.url, 'LICENSE.md', catalogEntry.commit_sha)) + `</div>`;
      } catch (e) {
        console.log(`Error calling getRepoContentsContent(${catalogEntry.repo.url}, "LICENSE.md", ${catalogEntry.commit_sha}): `, e);
      }

      setCopyright(copyrightAndLicense);
    };

    if (catalogEntry && targetBibleCatalogEntries.length) {
      generateCopyrightPage();
    }
  }, [catalogEntry, targetBibleCatalogEntries, setCopyright]);


  useEffect(() => {
    if (html && copyright) {
      setHtmlSections((prevState) => ({
        ...prevState,
        cover: `<h3>${bookTitle}</h3>`,
        copyright,
        body: html,
      }));
    }
  }, [html, copyright, bookTitle, setHtmlSections]);

  return <BibleReference status={bibleReferenceState} actions={bibleReferenceActions} style={{ minWidth: 'auto' }} />;
}
