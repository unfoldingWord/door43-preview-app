import usfm from 'usfm-js';
import { verseObjectsToString } from 'uw-quote-helpers';
import { insertUnmatchedCurlyBracesInQuote } from '@helpers/quotes';
import { encodeHTML, convertNoteFromMD2HTML, generateCopyrightAndLicenseHTML } from '@helpers/html';
import { BibleBookData } from '@common/books';
import { getSupportedBooks } from '@helpers/books';
import { getRepoGitTrees } from '@helpers/dcsApi';

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

.tn-note-label,
.tn-note-quote {
  font-weight: bold;
}

.tn-note-support-reference,
.tn-note-quote {
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
  content: '#' attr(data-descr);
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

.tn-note-body h4 ~ p,
.tn-note-body h4 ~ ul,
.tn-note-body h4 ~ ol {
  margin-left: 20px;
}

.tn-note-body h5 ~ p,
.tn-note-body h5 ~ ul,
.tn-note-body h5 ~ ol {
  margin-left: 40px;
}

.tn-note-body h6 ~ p,
.tn-note-body h6 ~ ul,
.tn-note-body h6 ~ ol {
  margin-left: 60px;
}

.tn-note-body h4 ~ h5 ~ h4 ~ p,
.tn-note-body h4 ~ h5 ~ h4 ~ ul,
.tn-note-body h4 ~ h5 ~ h4 ~ ol {
  margin-left: 40px;
}

.tn-note-body h5 ~ h6 ~ h5 ~ p,
.tn-note-body h5 ~ h6 ~ h5 ~ ul,
.tn-note-body h5 ~ h6 ~ h5 ~ ol {
  margin-left: 40px;
}

.tn-note-body h4 + * {
  margin-left: 20px !important;
}

.tn-note-body h5 + * {
  margin-left: 40px  !important;
}

.tn-note-body h6 + * {
  margin-left: 60px !important;
}

.tn-note-body h4 {
  margin-left: 10px !important;
  font-size: 1.2em !important;
}

.tn-note-body h5 {
  margin-left: 30px !important;
  font-size: 1.1em !important;
}

.tn-note-body h6 {
  margin-left: 50px !important;
  font-size: 1em !important;
}

h4 + h4 {
    margin-top: -0.5em;
}

h4:has(+ h4),
h4 + h4 {
    border: 1px solid #dee2e6;
    padding: 0.75em 1em;
    margin-top: 0;
    margin-bottom: 0;
    background-color: #f8f9fa;
}

h4:has(+ h4) {
    border-bottom: none;
    border-radius: 4px 4px 0 0;
}

h4 + h4 {
    border-top: none;
    border-radius: 0 0 4px 4px;
    margin-bottom: 1.5em;
}

ul.tn-verse-twl-list li.tn-verse-twl-list-item {
  margin: 0;
}
`;

const requiredSubjects = [
  'Aligned Bible',
  'Translation Academy',
  'Translation Words',
  'TSV Translation Words Links',
  'Hebrew Old Testament',
  'Greek New Testament'
];

const quoteTokenDelimiter = ' … ';

/**
 * Check if cached HTML is available and recent
 */
async function getCachedHtml(catalogEntry, expandedBooks, appVersion) {
  try {
    const cacheKey = `${catalogEntry.full_name}-${expandedBooks.join('-')}-${catalogEntry.commit_sha}-${appVersion}`;
    const response = await fetch(`/.netlify/functions/get-cached-html?key=${encodeURIComponent(cacheKey)}`);

    if (response.ok) {
      const cached = await response.json();
      return cached.html;
    }
  } catch (error) {
    console.log('No cached HTML found or error retrieving:', error);
  }
  return null;
}

/**
 * Cache the generated HTML
 */
async function setCachedHtml(catalogEntry, expandedBooks, appVersion, html, builtWith) {
  try {
    const cacheKey = `${catalogEntry.full_name}-${expandedBooks.join('-')}-${catalogEntry.commit_sha}-${appVersion}`;
    await fetch('/.netlify/functions/cache-html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: cacheKey,
        html,
        builtWith,
        timestamp: Date.now()
      })
    });
  } catch (error) {
    console.error('Failed to cache HTML:', error);
  }
}

/**
 * Fetch all required catalog entries in parallel
 */
async function fetchAllCatalogEntries(catalogEntry, expandedBooks, authToken) {
  // This would replace all the useFetchRelationCatalogEntries and related hooks
  // Implementation would use the same logic but with Promise.all instead of hooks

  const [
    relationCatalogEntries,
    repoFileList
  ] = await Promise.all([
    fetchRelationCatalogEntries(catalogEntry, requiredSubjects),
    getRepoGitTrees(catalogEntry.repo.url, catalogEntry.branch_or_tag_name, authToken, false)
      .then(trees => trees.map(tree => tree.path))
      .catch(e => {
        console.log(`Error calling getRepoGitTrees: `, e);
        return [];
      })
  ]);

  // Fetch all resource catalog entries in parallel
  const [
    sourceBibleCatalogEntries,
    targetBibleCatalogEntries,
    taCatalogEntries,
    twCatalogEntries,
    twlCatalogEntries
  ] = await Promise.all([
    fetchCatalogEntriesBySubject(relationCatalogEntries,
      BibleBookData[expandedBooks[0]]?.testament === 'old' ? 'Hebrew Old Testament' : 'Greek New Testament',
      expandedBooks[0], true),
    fetchCatalogEntriesBySubject(relationCatalogEntries, 'Aligned Bible', expandedBooks[0]),
    fetchCatalogEntriesBySubject(relationCatalogEntries, 'Translation Academy', null, true),
    fetchCatalogEntriesBySubject(relationCatalogEntries, 'Translation Words', null, true),
    fetchCatalogEntriesBySubject(relationCatalogEntries, 'TSV Translation Words Links', null, true)
  ]);

  return {
    relationCatalogEntries,
    repoFileList,
    sourceBibleCatalogEntries,
    targetBibleCatalogEntries,
    taCatalogEntries,
    twCatalogEntries,
    twlCatalogEntries
  };
}

/**
 * Fetch all book files and data in parallel
 */
async function fetchAllBookData(catalogEntries, expandedBooks, authToken) {
  const {
    sourceBibleCatalogEntries,
    targetBibleCatalogEntries,
    taCatalogEntries,
    twCatalogEntries,
    twlCatalogEntries
  } = catalogEntries;

  const [
    sourceUsfms,
    targetUsfms,
    tnTsvBookFiles,
    twlTsvBookFiles,
    taZipFileData,
    twZipFileData
  ] = await Promise.all([
    fetchBookFiles(sourceBibleCatalogEntries, expandedBooks[0]),
    fetchBookFiles(targetBibleCatalogEntries, expandedBooks[0]),
    fetchBookFiles([catalogEntry], expandedBooks[0]),
    fetchBookFiles(twlCatalogEntries, expandedBooks[0]),
    fetchZipFileData(taCatalogEntries?.[0]),
    fetchZipFileData(twCatalogEntries?.[0])
  ]);

  const [
    tnTsvData,
    twlTsvData,
    taFileContents,
    twFileContents
  ] = await Promise.all([
    pivotTsvFileOnReference(tnTsvBookFiles?.[0]),
    pivotTsvFileOnReference(twlTsvBookFiles?.[0]),
    generateTranslationAcademyFileContents(taCatalogEntries[0], taZipFileData),
    generateTranslationWordsFileContents(twCatalogEntries[0], twZipFileData)
  ]);

  const [
    tnTsvDataWithGLQuotes,
    twlTsvDataWithGLQuotes
  ] = await Promise.all([
    fetchGLQuotesForTsvData(tnTsvData, sourceUsfms?.[0], targetUsfms, quoteTokenDelimiter),
    fetchGLQuotesForTsvData(twlTsvData, sourceUsfms?.[0], targetUsfms, quoteTokenDelimiter)
  ]);

  return {
    sourceUsfms,
    targetUsfms,
    targetBibleCatalogEntries,
    tnTsvDataWithGLQuotes,
    twlTsvDataWithGLQuotes,
    taFileContents,
    twFileContents,
    taCatalogEntries,
    twCatalogEntries
  };
}

/**
 * Generate the complete HTML for Translation Notes
 */
async function generateTranslationNotesHtml(catalogEntry, expandedBooks, renderOptions, authToken, appVersion) {
  console.log('🚀 Starting Translation Notes HTML generation...');

  try {
    // Check for cached version first
    const cachedHtml = await getCachedHtml(catalogEntry, expandedBooks, appVersion);
    if (cachedHtml) {
      console.log('✅ Using cached HTML');
      return {
        html: cachedHtml,
        css: { web: webCss, print: '' },
        fromCache: true
      };
    }

    console.log('🔨 Generating new HTML...');

    // Fetch all catalog entries
    const catalogEntries = await fetchAllCatalogEntries(catalogEntry, expandedBooks, authToken);

    // Validate supported books
    const supportedBooks = getSupportedBooks(catalogEntry, catalogEntries.repoFileList);
    if (!supportedBooks.length) {
      throw new Error('There are no books in this resource to render.');
    }
    if (!supportedBooks.includes(expandedBooks[0])) {
      throw new Error(`This resource does not support the rendering of the book \`${expandedBooks[0]}\`.`);
    }

    // Fetch all book data
    const bookData = await fetchAllBookData(catalogEntries, expandedBooks, authToken);

    // Generate HTML content
    const html = await generateHtmlContent(catalogEntry, expandedBooks, renderOptions, bookData);

    // Generate copyright
    const builtWith = [
      catalogEntry,
      ...bookData.targetBibleCatalogEntries,
      ...(catalogEntries.sourceBibleCatalogEntries?.[0] ? [catalogEntries.sourceBibleCatalogEntries[0]] : []),
      ...(catalogEntries.taCatalogEntries?.[0] ? [catalogEntries.taCatalogEntries[0]] : []),
      ...(catalogEntries.twCatalogEntries?.[0] ? [catalogEntries.twCatalogEntries[0]] : []),
      ...(catalogEntries.twlCatalogEntries?.[0] ? [catalogEntries.twlCatalogEntries[0]] : [])
    ];

    const copyright = await generateCopyrightAndLicenseHTML(catalogEntry, builtWith, authToken);

    const result = {
      html,
      copyright,
      css: { web: webCss, print: '' },
      builtWith,
      fromCache: false
    };

    // Cache the result
    await setCachedHtml(catalogEntry, expandedBooks, appVersion, html, builtWith);

    console.log('✅ HTML generation complete');
    return result;

  } catch (error) {
    console.error('❌ Error generating Translation Notes HTML:', error);
    throw error;
  }
}

/**
 * Generate the main HTML content (extracted from the current component logic)
 */
async function generateHtmlContent(catalogEntry, expandedBooks, renderOptions, bookData) {
  const {
    targetUsfms,
    targetBibleCatalogEntries,
    tnTsvDataWithGLQuotes,
    twlTsvDataWithGLQuotes,
    taFileContents,
    twFileContents,
    taCatalogEntries,
    twCatalogEntries
  } = bookData;

  const bookTitle = catalogEntry.ingredients.filter(
    ingredient => ingredient.identifier === expandedBooks[0]
  ).map(ingredient => ingredient.title)[0] || expandedBooks[0];

  let html = `
<div class="section tn-book-section" id="nav-${expandedBooks[0]}" data-toc-title="${catalogEntry.title} - ${bookTitle}">
  <h1 class="header tn-book-section-header"><a href="#nav-${expandedBooks[0]}" class="header-link">${catalogEntry.title} - ${bookTitle}</a></h1>
`;

  let usfmJSONs = [];
  for (let targetUsfm of targetUsfms) {
    usfmJSONs.push(usfm.toJSON(targetUsfm));
  }

  const rcLinksData = {};

  // Front matter
  if ((!renderOptions.chapters || renderOptions.chapters.includes('front')) && tnTsvDataWithGLQuotes?.['front']?.['intro']) {
    html += generateFrontMatterHtml(tnTsvDataWithGLQuotes, catalogEntry, bookTitle, expandedBooks, rcLinksData);
  }

  // Chapters and verses
  html += await generateChaptersHtml(
    tnTsvDataWithGLQuotes,
    twlTsvDataWithGLQuotes,
    catalogEntry,
    bookTitle,
    expandedBooks,
    renderOptions,
    targetBibleCatalogEntries,
    usfmJSONs,
    twCatalogEntries,
    rcLinksData
  );

  html += `</div>`;

  // Appendices
  html += generateAppendicesHtml(rcLinksData, taCatalogEntries, twCatalogEntries, bookTitle, taFileContents, twFileContents);

  // Process RC links
  html = processRcLinks(html, rcLinksData);

  return html;
}

// Helper functions would go here (generateFrontMatterHtml, generateChaptersHtml, etc.)
// These would contain the logic currently in the component's generateHtml function

export { generateTranslationNotesHtml };
