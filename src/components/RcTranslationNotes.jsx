// React imports
import { useState, useEffect, useContext } from 'react';

// Bible reference imports
import { useBibleReference } from 'bible-reference-rcl';
import { BibleBookData } from '@common/books';
import BibleReference from 'bible-reference-rcl';

// Helper imports
import { getSupportedBooks } from '@helpers/books';
import { getRepoContentsContent, getRepoGitTrees } from '@helpers/dcsApi';
import { encodeHTML } from '@helpers/html';

// Hook imports
import useFetchRelationCatalogEntries from '@hooks/useFetchRelationCatalogEntries';
import useFetchCatalogEntryBySubject from '@hooks/useFetchCatalogEntryBySubject';
import useFetchBookFile from '@hooks/useFetchBookFile';
import useFetchZipFileData from '@hooks/useFetchZipFileData';
import useTsvGLQuoteAdder from '@hooks/useTsvDataStandardizer';
import useGenerateTranslationAcademyFileContents from '@hooks/useGenerateTranslationAcademyFileContents';
import useGenerateTranslationWordsFileContents from '@hooks/useGenerateTranslationWordsFileContents';

// Other imports
import usfm from 'usfm-js';
import MarkdownIt from 'markdown-it';
import { verseObjectsToString } from 'uw-quote-helpers';

// Context imports
import { AppContext } from '@components/App.context';

const webCss = `
.tn-scripture-header {
  margin: 0;
}

.tn-scripture-block {
  border: 1px solid black;
  padding: 10px;
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

article {
  break-after: auto !important;
  break-inside: avoid-page !important;
  orphans: 2;
  widows: 2;
}

hr {
  break-before: avoid-page !important;
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
`;

function convertNoteFromMD2HTML(note, bookId, chapterStr) {
  const md = new MarkdownIt();
  note = md.render(note.replaceAll('\\n', '\n').replaceAll('<br>', '\n'));
  note = note.replace(/href="\.\/0*([^/".]+)(\.md){0,1}"/g, `href="#hash-${bookId}-${chapterStr}-$1"`);
  note = note.replace(/href="\.\.\/0*([^/".]+)\/0*([^/".]+)(\.md){0,1}"/g, `href="#hash-${bookId}-$1-$2"`);
  note = note.replace(/href="0*([^#/".]+)(\.md){0,1}"/g, `href="#hash-${bookId}-${chapterStr}-$1"`);
  note = note.replace(/href="\/*0*([^#/".]+)\/0*([^/".]+)\.md"/g, `href="#hash-${bookId}-$1-$2"`);
  note = note.replace(/(?<![">])(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*))/g, '<a href="$1">$1</a>');
  note = note.replace(/(href="http[^"]+")/g, '$1 target="_blank"');
  note = note.replace(/<h4>/g, '<h6>').replace(/<\/h4>/g, '</h6>');
  note = note.replace(/<h3>/g, '<h5>').replace(/<\/h3>/g, '</h5>');
  note = note.replace(/<h2>/g, '<h4>').replace(/<\/h2>/g, '</h4>');
  note = note.replace(/<h1>/g, '<h3>').replace(/<\/h1>/g, '</h3>');
  note = note.replace(/\s*\(See: \[\[[^\]]+\]\]\)/, '');

  return note;
}

export default function RcTranslationNotes() {
  const {
    state: { urlInfo, catalogEntry, documentAnchor },
    actions: { setWebCss, setStatusMessage, setErrorMessage, setHtmlSections, setDocumentAnchor, setCanChangeColumns },
  } = useContext(AppContext);

  const [supportedBooks, setSupportedBooks] = useState([]);
  const [bookId, setBookId] = useState();
  const [bookTitle, setBookTitle] = useState();
  const [tsvText, setTsvText] = useState();
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
      const hash = `${b}-${c}-${v}`;
      if (!documentAnchor.startsWith(hash)) {
        setDocumentAnchor(hash);
      }
    }
  };

  const requiredSubjects = ['Aligned Bible', 'Translation Academy', 'Translation Words', 'TSV Translation Words Links', 'Hebrew Old Testament', 'Greek New Testament'];

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: bookId || urlInfo.hashParts[0] || 'gen',
    initialChapter: urlInfo.hashParts[1] || '1',
    initialVerse: urlInfo.hashParts[2] || '1',
    onChange: onBibleReferenceChange,
  });

  const relationCatalogEntries = useFetchRelationCatalogEntries({
    catalogEntry,
    requiredSubjects,
    setErrorMessage,
  });

  const sourceBibleCatalogEntry = useFetchCatalogEntryBySubject({
    catalogEntries: relationCatalogEntries,
    subject: BibleBookData[bookId]?.testament == 'old' ? 'Hebrew Old Testament' : 'Greek New Testament',
    bookId,
    setErrorMessage,
  });

  const sourceUsfm = useFetchBookFile({
    catalogEntry: sourceBibleCatalogEntry,
    bookId,
    setErrorMessage,
  });

  const targetBibleCatalogEntry = useFetchCatalogEntryBySubject({
    catalogEntries: relationCatalogEntries,
    subject: 'Aligned Bible',
    bookId,
    setErrorMessage,
  });

  const targetUsfm = useFetchBookFile({
    catalogEntry: targetBibleCatalogEntry,
    bookId,
    setErrorMessage,
  });

  const renderedTsvData = useTsvGLQuoteAdder({
    tsvText,
    sourceUsfm,
    targetUsfm,
  });

  const taCatalogEntry = useFetchCatalogEntryBySubject({
    catalogEntries: relationCatalogEntries,
    subject: 'Translation Academy',
    setErrorMessage,
  });

  const taZipFileData = useFetchZipFileData({
    catalogEntry: taCatalogEntry,
  });

  const taFileContents = useGenerateTranslationAcademyFileContents({
    catalogEntry: taCatalogEntry,
    zipFileData: taZipFileData,
    setErrorMessage,
  });

  const twCatalogEntry = useFetchCatalogEntryBySubject({
    catalogEntries: relationCatalogEntries,
    subject: 'Translation Words',
    setErrorMessage,
  });

  const twZipFileData = useFetchZipFileData({
    catalogEntry: twCatalogEntry,
  });

  const twFileContents = useGenerateTranslationWordsFileContents({
    catalogEntry: twCatalogEntry,
    zipFileData: twZipFileData,
    setErrorMessage,
  });

  const twlCatalogEntry = useFetchCatalogEntryBySubject({
    catalogEntries: relationCatalogEntries,
    subject: 'TSV Translation Words Links',
    setErrorMessage,
  });

  const twlTSVText = useFetchBookFile({
    catalogEntry: twlCatalogEntry,
    bookId,
    setErrorMessage,
  });

  const twlData = useTsvDataStandardizer({
    tsvText: twlTSVText,
    sourceUsfm,
    targetUsfm,
  });

  console.log(twlData);

  // const twlFileContents = useGenerateTranslationWordsLinksFileContents({
  //   catalogEntry: twCatalogEntry,
  //   twlTSVFile,
  //   setErrorMessage,
  // });

  useEffect(() => {
    if (documentAnchor && documentAnchor.split('-').length) {
      const parts = documentAnchor.split('-');
      if (bibleReferenceState.bookId == parts[0] && (bibleReferenceState.chapter != (parts[1] || '1') || bibleReferenceState.verse != (parts[2] || '1'))) {
        bibleReferenceActions.goToBookChapterVerse(parts[0], parts[1] || '1', parts[2] || '1');
      }
    }
  }, [documentAnchor]);

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

      let sb = getSupportedBooks(catalogEntry, repoFileList);
      if (!sb.length) {
        setErrorMessage('There are no books in this resource to render.');
        return;
      }
      setSupportedBooks(sb);
      bibleReferenceActions.applyBooksFilter(sb);

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
          Preparing preview for {title}.<br />
          Please wait...
        </>
      );
      if (!sb.includes(_bookId)) {
        setErrorMessage(`This resource does not support the rendering of the book \`${_bookId}\`. Please choose another book to render.`);
        sb = [_bookId, ...sb];
      }
    };

    if (!bookId) {
      setWebCss(webCss);
      setCanChangeColumns(false);
      setInitialBookIdAndSupportedBooks();
    }
  }, [bookId, urlInfo, catalogEntry, setCanChangeColumns, setErrorMessage, setSupportedBooks, setBookId, setWebCss]);

  useEffect(() => {
    const fetchTsvFileFromDCS = async () => {
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

      getRepoContentsContent(catalogEntry.repo.url, filePath, catalogEntry.commit_sha)
        .then((tsv) => setTsvText(tsv))
        .catch((e) => {
          console.log(`Error calling getRepoContentsContent(${catalogEntry.repo.url}, ${filePath}, ${catalogEntry.commit_sha}): `, e);
          setErrorMessage(`Unable to get content for book \`${bookId}\` from DCS`);
        });
    };

    if (catalogEntry && supportedBooks && bookId && supportedBooks.includes(bookId)) {
      fetchTsvFileFromDCS();
    }
  }, [supportedBooks, catalogEntry, bookId, setErrorMessage, setTsvText]);

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
            anchor: `appendex--${resource}--${file.replace(/\//g, '--')}`,
          };
          if (referenceWithLink) {
            data[resource][rcLink].backRefs.push(referenceWithLink);
          }
          const fileParts = file.split('/');
          switch (resource) {
            case 'ta':
              {
                const manualId = fileParts[0];
                const articleId = fileParts.slice(1).join('/');
                if (taFileContents[manualId]?.articles?.[articleId]) {
                  data[resource][rcLink].title = taFileContents[manualId].articles[articleId].title;
                  data[resource][rcLink].body = taFileContents[manualId].articles[articleId].body;
                }
              }
              break;
            case 'tw':
              {
                const category = fileParts[1];
                const articleId = fileParts.slice(2).join('/');
                data[resource][rcLink].title = twFileContents[category].articles[articleId].title;
                data[resource][rcLink].body = twFileContents[category].articles[articleId].body;
              }
              break;
          }
        }
      }
      return data;
    };

    const generateHtml = async () => {
      let html = `
<div class="section tn-book-section" id="hash-${bookId}" data-toc-title="${catalogEntry.title} - ${bookTitle}">
  <h1 class="header tn-book-section-header"><a href="#hash-${bookId}" class="header-link">${catalogEntry.title} - ${bookTitle}</a></h1>
`;
      const usfmJSON = usfm.toJSON(targetUsfm);
      const rcLinksData = {};

      if (renderedTsvData?.['front']?.['intro']) {
        html += `
      <div class="section tn-front-intro-section" data-toc-title="${bookTitle} Introduciton">
`;
        for (let row of renderedTsvData['front']['intro'])
          html += `
        <article class="tn-front-intro-note">
          <span class="header-title">${catalogEntry.title} :: ${bookTitle} :: Introduction</span>
          <div class="tn-note-body">
${convertNoteFromMD2HTML(row.Note, bookId, 'front')}
          </div>
        </article>
`;
      }
      html += `
      </div>
`;

      BibleBookData[bookId].chapters.forEach((numVerses, chapterIdx) => {
        const chapterStr = String(chapterIdx + 1);
        html += `
      <div id="hash-${bookId}-${chapterStr}" class="section tn-chapter-section" data-toc-title="${bookTitle} ${chapterStr}">
        <h2 class="tn-chapter-header"><a href="#hash-${bookId}-${chapterStr}" class="header-link">${bookTitle} ${chapterStr}</a></h2>
`;
        if (renderedTsvData?.[chapterStr]?.['intro']) {
          html += `
        <div class="section tn-chapter-intro-section">
`;
          for (let row of renderedTsvData[chapterStr]['intro']) {
            const link = `hash-${bookId}-${chapterStr}-intro-${row.ID}`;
            const article = `
          <article id="${link}">
            <span class="header-title">${catalogEntry.title} :: ${bookTitle} Introduction</span>
            ${convertNoteFromMD2HTML(row.Note, bookId, chapterStr)}
          </article>
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
          const scripture = verseObjectsToString(usfmJSON.chapters[chapterStr][verseStr].verseObjects);
          html += `
        <div id="hash-${bookId}-${chapterStr}-${verseStr}" class="section tn-chapter-verse-section">
          <h3 class="tn-verse-header"><a href="#hash-${bookId}-${chapterStr}-${verseStr}" class="header-link">${bookTitle} ${chapterStr}:${verseStr}</a></h3>
          <span class="header-title">${catalogEntry.title} :: ${bookTitle} ${chapterStr}:${verseStr}</span>
          <article class="tn-scripture-block" id="hash-${bookId}-${chapterStr}-${verseStr}-scripture">
            <h4 class="tn-scripture-header">
              <a href="#hash-${bookId}-${chapterStr}-${verseStr}-scripture" class="header-link">
                ${targetBibleCatalogEntry.abbreviation.toUpperCase()}:
              </a>
            </h4>
            <div class="tn-scripture-text">
              ${scripture}
            </div>
          </article>
`;
          if (renderedTsvData?.[chapterStr]?.[verseStr]) {
            for (let rowIdx in renderedTsvData[chapterStr][verseStr]) {
              const row = renderedTsvData[chapterStr][verseStr][rowIdx];
              const link = `hash-${bookId}-${chapterStr}-${verseStr}-${row.ID}`;
              let quote = row.GLQuote ? `“${row.GLQuote}”` : row.Quote ? `<span style="color: red">“${row.Quote}” (ORIG QUOTE)</span>` : '';
              let verseBridge = '';
              if (refStr != row.Reference) {
                verseBridge += `(${row.Reference})`;
              }
              let article = `
              <article id="${link}" class="tn-note-article">
              <h4 class="tn-note-header">
                <a href="#${link}" class="header-link">
                ${quote || 'Note:'} ${verseBridge}
                </a>
              </h4>
              <span class="header-title">${catalogEntry.title} :: ${bookTitle} ${row.Reference}</span>
              <div class="tn-note-body">
                ${convertNoteFromMD2HTML(row.Note, bookId, chapterStr)}
              </div>
`;
              if (row.SupportReference) {
                article += `
          <div class="tn-note-support-reference">
            <span class="tn-note-label">Support Reference:</span>
              [[${row.SupportReference}]]
          </div>
`;
              }
              article += `
        <hr style="width: 75%"/>
`;
              if (rowIdx == renderedTsvData[chapterStr][verseStr].length - 1) {
                article += `
        <hr style="width: 100%"/>
`;
              }
              article += `
      </article>
`;
              html += article;
              searchForRcLinks(rcLinksData, article, `<a href="#${link}">${row.Reference}</a>`);
            }
          } else {
            html += `
          <article class="tn-verse-no-notes">
            (There are no notes for this verse)
          </article>
`;
          }
          html += `
    </div>
`;
        }
        html += `
  </div>
`;
      });

      html += `
</div>
`;
      // TA ARTICLES
      html += `
<div class="appendex ta section" id="appendex-ta" data-toc-title="Appendex: ${encodeHTML(taCatalogEntry.title)}">
  <article class="title-page">
    <span class="header-title"></span>
    <img class="title-logo" src="https://cdn.door43.org/assets/uw-icons/logo-uta-256.png" alt="uta">
    <h1 class="cover-header section-header">${taCatalogEntry.title} - ${bookTitle}</h1>
    <h3 class="cover-version">${taCatalogEntry.branch_or_tag_name}</h3>
    <h3 class="cover-version">${bookTitle}</h3>
  </article>
`;
      Object.values(rcLinksData.ta)
        .sort((a, b) => (a.title.toLowerCase() < b.title.toLowerCase() ? -1 : a.title.toLowerCase() > b.title.toLowerCase() ? 1 : 0))
        .forEach((taArticle) => {
          const article = `
  <article id="${taArticle.anchor}" data-toc-title="${encodeHTML(taArticle.title)}">
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
  </article>
`;
          html += article;
          searchForRcLinks(rcLinksData, article);
        });
      html += `
</div>
`;

      // TW ARTICLES
      html += `
<div class="appendex tw section" id="appendex-tw" data-toc-title="Appendex: ${encodeHTML(taCatalogEntry.title)}">
  <article class="title-page">
    <span class="header-title"></span>
    <img class="title-logo" src="https://cdn.door43.org/assets/uw-icons/logo-utw-256.png" alt="uta">
    <h1 class="cover-header section-header">${twCatalogEntry.title} - ${bookTitle}</h1>
    <h3 class="cover-version">${twCatalogEntry.branch_or_tag_name}</h3>
    <h3 class="cover-version">${bookTitle}</h3>
  </article>
`;
      Object.values(rcLinksData.tw)
        .sort((a, b) => (a.title.toLowerCase() < b.title.toLowerCase() ? -1 : a.title.toLowerCase() > b.title.toLowerCase() ? 1 : 0))
        .forEach((twArticle) => {
          const article = `
  <article id="${twArticle.anchor}" data-toc-title="${encodeHTML(twArticle.title)}">
    <h2 class="header article-header">
      <a href="#${twArticle.anchor}" class="header-link">${twArticle.title}</a>
    </h2>
    <span class="header-title">${taCatalogEntry.title} :: ${twArticle.title}</span>
    <div class="article-body">
      ${twArticle.body}
    </div>
    <div class="back-refs">
    <h3>${bookTitle} References:</h3>
    ${twArticle.backRefs.join('; ')}
  </article>
`;
          html += article;
          searchForRcLinks(rcLinksData, article);
        });
      html += `
</div>
`;

      for (let data of Object.values(rcLinksData.ta)) {
        let regex = new RegExp(`\\[*${data.rcLink.replace(/rc:\/\/[^/]+\//, 'rc://[^/]+/')}\\]*`, 'g');
        html = html.replace(regex, `<a href="#${data.anchor}">${data.title}</a>`);
      }
      for (let data of Object.values(rcLinksData.tw)) {
        let regex = new RegExp(`\\[*${data.rcLink.replace(/rc:\/\/[^/]+\//, 'rc://[^/]+/')}\\]*`, 'g');
        html = html.replace(regex, `<a href="#${data.anchor}">${data.title}</a>`);
      }
      setHtml(html);
    };

    if (targetBibleCatalogEntry && renderedTsvData && targetUsfm && taFileContents) {
      generateHtml();
    }
  }, [
    catalogEntry,
    taCatalogEntry,
    bookId,
    bookTitle,
    targetBibleCatalogEntry,
    renderedTsvData,
    targetUsfm,
    taFileContents,
    twFileContents,
    setHtmlSections,
    setErrorMessage,
    setDocumentAnchor,
  ]);

  useEffect(() => {
    const generateCopyrightPage = async () => {
      const entries = [catalogEntry, sourceBibleCatalogEntry, targetBibleCatalogEntry, taCatalogEntry, twCatalogEntry];

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

    if (catalogEntry && sourceBibleCatalogEntry && targetBibleCatalogEntry && taCatalogEntry && twCatalogEntry) {
      generateCopyrightPage();
    }
  }, [catalogEntry, sourceBibleCatalogEntry, targetBibleCatalogEntry, taCatalogEntry, twCatalogEntry, setCopyright]);

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
