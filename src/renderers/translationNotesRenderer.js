/**
 * Translation Notes HTML Renderer
 * 
 * Standalone library for generating HTML from Translation Notes resources.
 * Can be used independently of React or any UI framework.
 * 
 * @module translationNotesRenderer
 * @author unfoldingWord
 * @license MIT
 */

import { verseObjectsToString } from 'uw-quote-helpers';
import { getTargetQuoteFromSourceQuote } from 'uw-quote-helpers';
import { insertUnmatchedCurlyBracesInQuote } from '@helpers/quotes';
import { encodeHTML, convertNoteFromMD2HTML, generateCopyrightAndLicenseHTML } from '@helpers/html';
import { BibleBookData } from '@common/books';
import { getRelationCatalogEntries } from '@helpers/dcsCatalog';
import { getRepoGitTrees, getRepoContentsContent } from '@helpers/dcsApi';
import pako from 'pako';
import usfm from 'usfm-js';
import * as JSZip from 'jszip';
import markdownit from 'markdown-it';
import yaml from 'yaml';

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

const printCss = `
html {
  font-size: 10pt !important;
}

.article {
  break-before: auto !important;
  break-after: auto !important;
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
 * Fetch all book files for given catalog entries
 * @private
 */
async function fetchBookFiles(catalogEntries, bookId, authToken) {
  if (!catalogEntries?.length || !bookId) {
    return [];
  }

  const promises = [];
  catalogEntries.forEach((catalogEntry) => {
    if (!catalogEntry) return;
    
    let filePath = '';
    catalogEntry?.ingredients?.forEach((ingredient) => {
      if (ingredient.identifier == bookId) {
        filePath = ingredient.path.replace(/^\./, '');
      }
    });
    
    if (!filePath) {
      console.warn(`Resource ${catalogEntry?.full_name} does not contain project for ${bookId}`);
      return;
    }
    
    promises.push(
      getRepoContentsContent(catalogEntry.repo.url, filePath, catalogEntry.branch_or_tag_name, authToken)
        .catch(error => {
          console.error(`Error fetching ${filePath}:`, error);
          return null;
        })
    );
  });

  const contents = await Promise.all(promises);
  return contents.filter(content => content);
}

/**
 * Fetch catalog entries by subject
 * @private
 */
async function fetchCatalogEntriesBySubject(catalogEntries, subject, bookId, firstOnly = false) {
  let entries = [];
  
  for (let entry of catalogEntries) {
    if (entry.subject == subject) {
      for (let ingredient of entry.ingredients) {
        if (!bookId || ingredient.identifier == bookId) {
          entries.push(entry);
          if (firstOnly) {
            return entries;
          }
          break;
        }
      }
    }
  }
  
  if (!entries.length) {
    throw new Error(`No relation found of subject "${subject}" for book "${bookId}"`);
  }
  
  return entries;
}

/**
 * Fetch relation catalog entries from DCS
 * @private
 */
async function fetchRelationCatalogEntries(catalogEntry, requiredSubjects, authToken) {
  const catalogApiUrl = catalogEntry?.url.match(/^(.*\/catalog)\/entry\//)?.[1];
  if (!catalogApiUrl) {
    throw new Error('Not a valid catalog entry');
  }

  const metadataUrl = `${catalogApiUrl}/metadata/${catalogEntry.owner}/${catalogEntry.repo.name}/${catalogEntry.branch_or_tag_name}`;
  
  const response = await fetch(metadataUrl, {
    cache: 'default',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Bad response from DCS for ${metadataUrl}`);
  }

  const metadata = await response.json();
  
  if (!metadata) {
    throw new Error('No metadata found for this resource');
  }
  
  if (!metadata?.dublin_core?.relation) {
    throw new Error('No dublin_core.relation property in manifest.yaml');
  }

  // Add required Bible texts
  const relations = [...metadata.dublin_core.relation];
  if (requiredSubjects.includes('Greek New Testament')) {
    relations.push('el-x-koine/ugnt');
  }
  if (requiredSubjects.includes('Hebrew Old Testament')) {
    relations.push('hbo/uhb');
  }

  return getRelationCatalogEntries(catalogEntry, relations, requiredSubjects, authToken);
}

/**
 * Fetch and decompress zip file data
 * @private
 */
async function fetchZipFileData(catalogEntry, authToken) {
  if (!catalogEntry?.zipball_url) {
    return null;
  }

  try {
    const response = await fetch(catalogEntry.zipball_url, {
      cache: 'default',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch zipball: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return JSZip.loadAsync(arrayBuffer);
  } catch (error) {
    console.error('Error fetching zip file:', error);
    return null;
  }
}

/**
 * Pivot TSV file data on reference (chapter and verse)
 * Returns structure: { chapter: { verse: [rows] } }
 * @private
 */
async function pivotTsvFileOnReference(tsvData) {
  if (!tsvData) {
    return {};
  }

  const lines = tsvData.split('\n');
  const headers = lines[0].split('\t');
  
  const pivoted = {};
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split('\t');
    const row = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    // Skip rows without ID
    if (!row.ID) {
      continue;
    }
    
    // Build reference from Chapter and Verse
    if (row.Chapter && row.Verse) {
      row.Reference = `${row.Chapter}:${row.Verse}`;
      row.Note = row.OccurrenceNote;
      row.Quote = row.OrigQuote;
      if (row.SupportReference && !row.SupportReference.includes('/')) {
        row.SupportReference = `rc://*/ta/man/translate/${row.SupportReference}`;
      }
    }
    
    if (!row.Reference) {
      continue;
    }
    
    // Split reference into chapter and verse
    const reference = row.Reference.split(':');
    const chapter = reference[0];
    const verse = reference[1] || '0';
    const first_verse = verse.split(',')[0].split('-')[0];
    
    // Create nested structure: chapter -> verse -> rows
    if (!pivoted[chapter]) {
      pivoted[chapter] = {};
    }
    if (!pivoted[chapter][first_verse]) {
      pivoted[chapter][first_verse] = [];
    }
    pivoted[chapter][first_verse].push(row);
  }
  
  return pivoted;
}

/**
 * Generate GL quotes for TSV data with SHA-256 caching
 * @private
 */
async function fetchGLQuotesForTsvData(
  tsvData,
  sourceUsfm,
  targetUsfms,
  quoteTokenDelimiter = null,
  ol2GlQuoteDictionary = {}
) {
  if (!tsvData || !sourceUsfm || !targetUsfms?.length) {
    return { renderedData: tsvData, newOl2GlQuoteDictionary: {} };
  }

  // Generate hash for params to ensure uniqueness
  const generateParamsHash = async (params) => {
    const paramString = JSON.stringify(params, Object.keys(params).sort());
    const encoder = new TextEncoder();
    const data = encoder.encode(paramString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const data = tsvData.map(row => ({ ...row }));
  const ol2GlDict = {};
  
  for (let row of data) {
    let quote = (row.Quote || '').trim();
    let reference = (row.Reference || '').trim();
    
    if (quote && reference) {
      let options = {
        occurrence: row.Occurrence || 1,
        fromOrigLang: true,
        quoteTokenDelimiter,
      };

      for (let targetBookIdx in targetUsfms) {
        let targetUsfm = targetUsfms[targetBookIdx];
        
        if (targetUsfm) {
          let params = {
            quote,
            ref: reference,
            sourceUsfm,
            targetUsfm,
            options,
          };

          try {
            const paramsHash = await generateParamsHash(params);
            
            if (ol2GlQuoteDictionary[paramsHash]) {
              row[`GLQuote${targetBookIdx}`] = ol2GlQuoteDictionary[paramsHash];
              ol2GlDict[paramsHash] = {
                ref: params.ref,
                targetBookIdx: targetBookIdx,
                occurrence: params.options.occurrence,
                fromOrigLang: params.options.fromOrigLang,
                quoteTokenDelimiter: params.options.quoteTokenDelimiter,
                ol: params.quote,
                gl: ol2GlQuoteDictionary[paramsHash],
              };
            } else {
              let glQuote = getTargetQuoteFromSourceQuote(params);
              if (quoteTokenDelimiter) {
                glQuote = glQuote.replace(/ *& */g, quoteTokenDelimiter);
              }
              if (glQuote) {
                ol2GlDict[paramsHash] = {
                  ref: params.ref,
                  targetBookIdx: targetBookIdx,
                  occurrence: params.options.occurrence,
                  fromOrigLang: params.options.fromOrigLang,
                  quoteTokenDelimiter: params.options.quoteTokenDelimiter,
                  ol: params.quote,
                  gl: glQuote,
                };
                row[`GLQuote${targetBookIdx}`] = glQuote;
              } else {
                row[`GLQuote${targetBookIdx}`] = '';
              }
            }
          } catch (e) {
            row[`GLQuote${targetBookIdx}`] = '';
          }
        } else {
          row[`GLQuote${targetBookIdx}`] = '';
        }
      }
    } else {
      for (let targetBookIdx in targetUsfms) {
        row[`GLQuote${targetBookIdx}`] = '';
      }
    }
  }

  return { 
    renderedData: data, 
    newOl2GlQuoteDictionary: Object.keys(ol2GlDict).length > 0 ? ol2GlDict : {} 
  };
}

/**
 * Generate Translation Academy file contents from zip data
 * @private
 */
async function generateTranslationAcademyFileContents(catalogEntry, zipFileData) {
  if (!catalogEntry || !zipFileData) {
    return {};
  }

  const articleMap = {};
  
  catalogEntry.ingredients
    .sort((a, b) => (a.sort > b.sort ? 1 : b.sort > a.sort ? -1 : 0))
    .forEach((ingredient, i) => {
      const manualPath = `${catalogEntry.repo.name.toLowerCase()}/${ingredient.path.replace(/^\.\//, '')}`;
      if (!(manualPath + '/' in zipFileData.files)) {
        console.warn(`Manual given in manifest file does not exist: ${ingredient.identifier}`);
        return;
      }
      articleMap[ingredient.identifier] = {
        id: ingredient.identifier,
        sort: ingredient.sort ? ingredient.sort : i,
        title: ingredient.title,
        articles: {},
        toc: null,
        config: null,
      };
    });

  const entries = Object.keys(zipFileData.files)
    .filter(
      (name) =>
        name.split('/').slice(1, 2)[0] in articleMap &&
        (name.endsWith('01.md') || name.endsWith('title.md') || name.endsWith('sub-title.md') || 
         name.endsWith('toc.yaml') || name.endsWith('config.yaml'))
    )
    .map((name) => zipFileData.files[name]);

  const listOfPromises = entries.map((entry) => 
    entry.async('uint8array').then((u8) => [entry.name, u8])
  );
  const promiseOfList = Promise.all(listOfPromises);

  const md = markdownit({
    html: true,
    linkify: true,
    typographer: true,
  });

  const list = await promiseOfList;
  
  list.forEach((current) => {
    const currentName = current[0];
    const currentValue = current[1];
    const nameParts = currentName.split('/');
    const manualId = nameParts[1];

    if (nameParts[2].endsWith('toc.yaml')) {
      articleMap[manualId].toc = yaml.parse(new TextDecoder().decode(currentValue));
      return;
    }
    if (nameParts[2].endsWith('config.yaml')) {
      articleMap[manualId].config = yaml.parse(new TextDecoder().decode(currentValue));
      return;
    }

    const articleId = nameParts[2];
    if (!(articleId in articleMap[manualId].articles)) {
      articleMap[manualId].articles[articleId] = {
        id: articleId,
      };
    }

    let body = '';
    switch (nameParts[3]) {
      case 'title.md':
        articleMap[manualId].articles[articleId].title = new TextDecoder().decode(currentValue).trim();
        return;
      case 'sub-title.md':
        articleMap[manualId].articles[articleId].subtitle = new TextDecoder().decode(currentValue).trim();
        return;
      case '01.md':
      default:
        body = md.render(new TextDecoder().decode(currentValue));
        body = body.replace(/href="\.\.\/([^/".]+)\/*(01.md){0,1}"/g, `href="#${manualId}--$1"`);
        body = body.replace(/href="\.\.\/\.\.\/([^/".]+)\/([^/".]+)\/*(01.md){0,1}"/g, `href="#$1--$2"`);
        body = body.replace(/(?<![">])(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/g, '<a href="$1">$1</a>');
        body = body.replace(/(href="http[^"]+")/g, '$1 target="_blank"');
        articleMap[manualId].articles[articleId].body = body;
    }
  });

  return articleMap;
}

/**
 * Generate Translation Words file contents from zip data
 * @private
 */
async function generateTranslationWordsFileContents(catalogEntry, zipFileData) {
  if (!catalogEntry || !zipFileData) {
    return {};
  }

  const articleMap = {};
  let ingredient = null;
  let biblePath = '';
  
  catalogEntry.ingredients.forEach((i) => {
    if (i.identifier == 'bible') {
      ingredient = i;
      biblePath = `${catalogEntry.repo.name.toLowerCase()}/${i.path.replace(/^\.\//, '')}`;
    }
  });

  if (!biblePath || !(biblePath + '/' in zipFileData.files)) {
    console.warn(`Path given in manifest file does not exist: ${ingredient?.path}`);
    return {};
  }

  const categories = {
    kt: {
      title: 'Key Terms',
      sort: 0,
    },
    names: {
      title: 'Names',
      sort: 1,
    },
    other: {
      title: 'Other',
      sort: 2,
    },
  };

  for (let categoryId in categories) {
    let category = categories[categoryId];
    const categoryPath = `${biblePath}/${categoryId}`;
    if (!(categoryPath + '/' in zipFileData.files)) {
      continue;
    }
    articleMap[categoryId] = {
      id: categoryId,
      sort: category.sort,
      title: category.title,
      articles: {},
    };
  }

  const listOfPromises = Object.keys(zipFileData.files)
    .filter((name) => name.split('/').slice(2, 3)?.[0] in categories && name.endsWith('.md'))
    .map((name) => zipFileData.files[name].async('uint8array').then((u8) => [name, u8]));

  const promiseOfList = Promise.all(listOfPromises);

  const md = markdownit({
    html: true,
    linkify: true,
    typographer: true,
  });

  const list = await promiseOfList;
  
  list.forEach((current) => {
    const currentName = current[0];
    const currentValue = current[1];
    const nameParts = currentName.split('/');
    const categoryId = nameParts[2];
    const articleId = nameParts[3].split('.')[0];

    if (!(articleId in articleMap[categoryId].articles)) {
      articleMap[categoryId].articles[articleId] = {
        id: articleId,
      };
    }

    let body = md.render(new TextDecoder().decode(currentValue));
    body = body.replace(/href="\.\/([^/".]+).md"/g, `href="#${categoryId}--$1"`);
    body = body.replace(/href="\.\.\/([^/".]+)\/*([^/]+).md"/g, `href="#$1--$2"`);
    body = body.replace(/(?<![">])(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/g, '<a href="$1">$1</a>');
    body = body.replace(/(href="http[^"]+")/g, '$1 target="_blank"');

    let title = '';
    const headerMatch = body.match(/^\s*<(h\d)>(.*?)<\/\1>\s*\n(.*)/ms);
    if (headerMatch) {
      title = headerMatch[2];
      body = headerMatch[3];
    }

    articleMap[categoryId].articles[articleId].title = title;
    articleMap[categoryId].articles[articleId].body = body;
  });

  return articleMap;
}

/**
 * Main function to generate Translation Notes HTML
 * 
 * @param {Object} params - Configuration parameters
 * @param {string} params.owner - Repository owner (e.g., 'unfoldingWord')
 * @param {string} params.repo - Repository name (e.g., 'en_tn')
 * @param {string} params.ref - Branch or tag name (e.g., 'master', 'v86')
 * @param {string} params.bookId - Book identifier (e.g., 'gen', 'tit')
 * @param {Object} params.catalogEntry - DCS catalog entry object
 * @param {string} [params.authToken] - Optional authentication token
 * @param {Object} [params.renderOptions] - Optional rendering configuration
 * @param {Function} [params.onProgress] - Progress callback function
 * @returns {Promise<Object>} Object containing {html, builtWith, css}
 */
export async function generateTranslationNotesHtml({
  owner,
  repo,
  ref,
  bookId,
  catalogEntry,
  authToken = null,
  renderOptions = {},
  onProgress = null
}) {
  try {
    // Report progress
    const progress = (message, percent) => {
      if (onProgress) onProgress(message, percent);
    };

    progress('Fetching catalog metadata...', 5);

    // Fetch all required catalog entries
    const relationCatalogEntries = await fetchRelationCatalogEntries(
      catalogEntry,
      requiredSubjects,
      authToken
    );

    progress('Fetching resource files...', 15);

    // Determine testament for source Bible
    const testament = BibleBookData[bookId]?.testament;
    const sourceBibleSubject = testament === 'old' ? 'Hebrew Old Testament' : 'Greek New Testament';

    // Fetch all catalog entries by subject in parallel
    const [
      sourceBibleCatalogEntries,
      targetBibleCatalogEntries,
      taCatalogEntries,
      twCatalogEntries,
      twlCatalogEntries
    ] = await Promise.all([
      fetchCatalogEntriesBySubject(relationCatalogEntries, sourceBibleSubject, bookId, true),
      fetchCatalogEntriesBySubject(relationCatalogEntries, 'Aligned Bible', bookId),
      fetchCatalogEntriesBySubject(relationCatalogEntries, 'Translation Academy', null, true),
      fetchCatalogEntriesBySubject(relationCatalogEntries, 'Translation Words', null, true),
      fetchCatalogEntriesBySubject(relationCatalogEntries, 'TSV Translation Words Links', null, true)
    ]);

    progress('Fetching book files...', 30);

    // Fetch all book files in parallel
    const [
      sourceUsfms,
      targetUsfms,
      tnTsvBookFiles,
      twlTsvBookFiles,
      taZipFileData,
      twZipFileData
    ] = await Promise.all([
      fetchBookFiles(sourceBibleCatalogEntries, bookId, authToken),
      fetchBookFiles(targetBibleCatalogEntries, bookId, authToken),
      fetchBookFiles([catalogEntry], bookId, authToken),
      fetchBookFiles(twlCatalogEntries, bookId, authToken),
      fetchZipFileData(taCatalogEntries?.[0], authToken),
      fetchZipFileData(twCatalogEntries?.[0], authToken)
    ]);

    progress('Processing TSV data...', 50);

    // Process TSV files
    const tnTsvData = await pivotTsvFileOnReference(tnTsvBookFiles?.[0]);
    const twlTsvData = await pivotTsvFileOnReference(twlTsvBookFiles?.[0]);
    const taFileContents = await generateTranslationAcademyFileContents(taCatalogEntries[0], taZipFileData);
    const twFileContents = await generateTranslationWordsFileContents(twCatalogEntries[0], twZipFileData);

    progress('Generating quotes...', 70);

    // Generate GL quotes for both TN and TWL
    // Flatten the nested structure: chapter -> verse -> rows
    const tnDataFlat = [];
    for (let chapter in tnTsvData) {
      for (let verse in tnTsvData[chapter]) {
        tnDataFlat.push(...tnTsvData[chapter][verse]);
      }
    }
    
    // Note: We no longer use DynamoDB caching - quotes are generated fresh each time
    const ol2GlQuoteDictionary = {};
    
    const { renderedData: tnRenderedData, newOl2GlQuoteDictionary: tnOl2GlDict } = await fetchGLQuotesForTsvData(
      tnDataFlat,
      sourceUsfms[0],
      targetUsfms,
      quoteTokenDelimiter,
      ol2GlQuoteDictionary
    );

    // Reconstruct pivoted structure with GL quotes
    const tnTsvDataWithGLQuotes = {};
    let flatIdx = 0;
    for (let ref in tnTsvData) {
      tnTsvDataWithGLQuotes[ref] = {};
      for (let verse in tnTsvData[ref]) {
        tnTsvDataWithGLQuotes[ref][verse] = tnTsvData[ref][verse].map(() => tnRenderedData[flatIdx++]);
      }
    }

    // Same for TWL
    const twlDataFlat = [];
    for (let chapter in twlTsvData) {
      for (let verse in twlTsvData[chapter]) {
        twlDataFlat.push(...twlTsvData[chapter][verse]);
      }
    }
    
    const { renderedData: twlRenderedData } = await fetchGLQuotesForTsvData(
      twlDataFlat,
      sourceUsfms[0],
      targetUsfms,
      quoteTokenDelimiter,
      tnOl2GlDict
    );

    const twlTsvDataWithGLQuotes = {};
    flatIdx = 0;
    for (let ref in twlTsvData) {
      twlTsvDataWithGLQuotes[ref] = {};
      for (let verse in twlTsvData[ref]) {
        twlTsvDataWithGLQuotes[ref][verse] = twlTsvData[ref][verse].map(() => twlRenderedData[flatIdx++]);
      }
    }

    progress('Building HTML...', 85);

    // Get book title
    const bookTitle = BibleBookData[bookId]?.name || bookId;

    // Generate final HTML
    const html = buildTranslationNotesHtml({
      bookId,
      bookTitle,
      tnTsvData: tnTsvDataWithGLQuotes,
      twlTsvData: twlTsvDataWithGLQuotes,
      sourceUsfms,
      targetUsfms,
      targetBibleCatalogEntries,
      taFileContents,
      twFileContents,
      taCatalogEntries,
      twCatalogEntries,
      catalogEntry
    });

    progress('Complete!', 100);

    return {
      html,
      css: { web: webCss, print: printCss },
      builtWith: {
        tn: catalogEntry,
        sourceBible: sourceBibleCatalogEntries[0],
        targetBibles: targetBibleCatalogEntries,
        ta: taCatalogEntries[0],
        tw: twCatalogEntries[0],
        twl: twlCatalogEntries[0]
      }
    };
  } catch (error) {
    console.error('Error generating Translation Notes HTML:', error);
    throw error;
  }
}

/**
 * Build the actual HTML from processed data
 * @private
 */
function buildTranslationNotesHtml({
  bookId,
  bookTitle,
  tnTsvData,
  twlTsvData,
  sourceUsfms,
  targetUsfms,
  targetBibleCatalogEntries,
  taFileContents,
  twFileContents,
  taCatalogEntries,
  twCatalogEntries,
  catalogEntry
}) {
  // Helper function to search for RC links in article content
  const searchForRcLinks = (data, article, referenceWithLink = null) => {
    const rcLinkRegex = /href="rc:\/\/[^/]+\/([^/]+)\/([^/]+)\/([^"]+)"/g;
    let match;
    
    while ((match = rcLinkRegex.exec(article)) !== null) {
      const resource = match[1]; // ta or tw
      const lang = match[2];
      const filePath = match[3];
      const fileParts = filePath.split('/');
      const rcLink = `${resource}--${filePath.replace(/\//g, '--').replace(/\.md$/, '')}`;

      if (!data[resource]) {
        data[resource] = {};
      }
      if (!data[resource][rcLink]) {
        data[resource][rcLink] = {
          anchor: rcLink,
          title: '',
          body: '',
          backRefs: [],
        };
      }

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

      if (referenceWithLink && !data[resource][rcLink].backRefs.includes(referenceWithLink)) {
        data[resource][rcLink].backRefs.push(referenceWithLink);
      }
    }
    return data;
  };

  let html = `
<div class="section tn-book-section" id="nav-${bookId}" data-toc-title="${catalogEntry.title} - ${bookTitle}">
  <h1 class="header tn-book-section-header"><a href="#nav-${bookId}" class="header-link">${catalogEntry.title} - ${bookTitle}</a></h1>
`;

  // Parse USFM for all target Bibles
  let usfmJSONs = [];
  for (let targetUsfm of targetUsfms) {
    usfmJSONs.push(usfm.toJSON(targetUsfm));
  }

  const rcLinksData = {};

  // Front matter / Introduction
  if (tnTsvData?.['front']?.['intro']) {
    html += `
  <div id="nav-${bookId}-front-intro" class="section tn-front-intro-section" data-toc-title="${bookTitle} Introduction">
`;
    for (let row of tnTsvData['front']['intro']) {
      const link = `nav-${bookId}-front-intro-${row.ID}`;
      const article = `
    <div class="article tn-front-intro-note" id="${link}">
      <span class="header-title">${catalogEntry.title} :: ${bookTitle} :: Introduction</span>
      <div class="tn-note-body">
${convertNoteFromMD2HTML(row.Note, bookId, 'front')}
      </div>
    </div>
`;
      searchForRcLinks(rcLinksData, article, `<a href="#${link}">${row.Reference}</a>`);
      html += article;
    }
    html += `
  </div>
`;
  }

  // Chapters and verses
  for (let chapterIdx = 0; chapterIdx < BibleBookData[bookId].chapters.length; chapterIdx++) {
    const numVerses = BibleBookData[bookId].chapters[chapterIdx];
    const chapterStr = String(chapterIdx + 1);

    html += `
  <div id="nav-${bookId}-${chapterStr}" class="section tn-chapter-section" data-toc-title="${bookTitle} ${chapterStr}">
    <h2 class="header tn-chapter-header"><a href="#nav-${bookId}-${chapterStr}" class="header-link">${bookTitle} ${chapterStr}</a></h2>
`;

    // Chapter introduction
    if (tnTsvData?.[chapterStr]?.['intro']) {
      html += `
    <div class="section tn-chapter-intro-section" id="nav-${bookId}-${chapterStr}-intro">
`;
      for (let row of tnTsvData[chapterStr]['intro']) {
        const link = `nav-${bookId}-${chapterStr}-intro-${row.ID}`;
        const article = `
      <div class="article tn-note-body" id="${link}">
        <span class="header-title">${catalogEntry.title} :: ${bookTitle} ${chapterStr} Introduction</span>
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

    // Individual verses
    for (let verseIdx = 0; verseIdx < numVerses; verseIdx++) {
      const verseStr = String(verseIdx + 1);
      const refStr = `${chapterStr}:${verseStr}`;
      const verseLink = `nav-${bookId}-${chapterStr}-${verseStr}`;

      html += `
    <div id="${verseLink}" class="section tn-chapter-verse-section">
      <h3 class="header tn-verse-header"><a href="#${verseLink}" class="header-link">${bookTitle} ${chapterStr}:${verseStr}</a></h3>
      <span class="header-title">${catalogEntry.title} :: ${bookTitle} ${chapterStr}:${verseStr}</span>
`;

      // Scripture blocks from target Bibles
      let scripture = {};
      for (let targetIdx in targetBibleCatalogEntries) {
        const targetBibleCatalogEntry = targetBibleCatalogEntries[targetIdx];
        let usfmJSONVerseStr = verseStr;

        if (!(chapterStr in (usfmJSONs[targetIdx]?.chapters || {}))) {
          continue;
        }
        if (!(verseStr in usfmJSONs[targetIdx].chapters[chapterStr])) {
          // Handle verse bridges
          for (let v of Object.keys(usfmJSONs[targetIdx].chapters[chapterStr])) {
            if (v.includes('-') || v.includes(',')) {
              let verses = [];
              const separateVerseSpans = v.split(',');
              for (let span of separateVerseSpans) {
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

        scripture[targetIdx] = verseObjectsToString(
          usfmJSONs[targetIdx]?.chapters[chapterStr]?.[usfmJSONVerseStr]?.verseObjects || []
        );
        const scriptureLink = `nav-${bookId}-${chapterStr}-${verseStr}-${targetBibleCatalogEntry.abbreviation}`;

        html += `
      <div class="article tn-scripture-block" id="${scriptureLink}">
        <h4 class="header tn-scripture-header">
          <a href="#${scriptureLink}" class="header-link" data-descr="${targetBibleCatalogEntry.abbreviation}">
            ${targetBibleCatalogEntry.abbreviation.toUpperCase()}:
          </a>
        </h4>
        <div class="tn-scripture-text">
          ${scripture[targetIdx]}${usfmJSONVerseStr != verseStr ? ` (vv${usfmJSONVerseStr})` : ''}
        </div>
      </div>
`;
      }

      // Translation Notes for this verse
      if (tnTsvData?.[chapterStr]?.[verseStr]) {
        for (let rowIdx in tnTsvData[chapterStr][verseStr]) {
          const row = tnTsvData[chapterStr][verseStr][rowIdx];
          const noteLink = `nav-${bookId}-${chapterStr}-${verseStr}-${row.ID}`;
          let verseBridge = '';
          if (refStr != row.Reference) {
            verseBridge += ` (${row.Reference})`;
          }

          let article = `
          <div class="article tn-note-article" id="${noteLink}">
`;

          if (!row.Quote || row.Quote.endsWith(':')) {
            article += `
            <h4 class="header tn-note-header">
              <a href="#${noteLink}" class="header-link" data-descr="${row.ID}">
              Note:${verseBridge}
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
                ? `<span style="color: red">"${row.Quote}" (ORIG QUOTE)</span>`
                : '';

              article += `
            <h4 class="header tn-note-header">
              <a href="#${noteLink}" class="header-link" data-descr="${row.ID}">
              ${quote}${verseBridge} (${targetBibleCatalogEntry.abbreviation.toUpperCase()})
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

      // Translation Words Links for this verse
      if (twlTsvData?.[chapterStr]?.[verseStr]) {
        const twlLink = `twl-${bookId}-${chapterStr}-${verseStr}`;
        let article = `
      <div class="article tn-verse-twls" id="${twlLink}">
        <h4 class="header tn-verse-twl-header">${twCatalogEntries?.[0]?.title || 'Translation Words'}</h4>
`;
        for (let targetIdx in targetBibleCatalogEntries) {
          const targetBibleCatalogEntry = targetBibleCatalogEntries[targetIdx];
          const glQuoteCol = `GLQuote${targetIdx}`;
          article += `
        <h5 class="tn-verse-twl-bible">${targetBibleCatalogEntry.abbreviation.toUpperCase()}</h5>
        <ul class="tn-verse-twl-list">
`;
          for (let row of twlTsvData[chapterStr][verseStr]) {
            let glQuote = row[glQuoteCol];
            glQuote = glQuote
              ? insertUnmatchedCurlyBracesInQuote(row[glQuoteCol], scripture[targetIdx], quoteTokenDelimiter)
              : row.Quote + ' (ORIG QUOTE)';
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

  // Translation Academy Appendix
  if (rcLinksData.ta && taCatalogEntries?.length) {
    const taCatalogEntry = taCatalogEntries[0];
    html += `
<div class="appendex ta section" id="appendex-ta" data-toc-title="Appendix: ${encodeHTML(taCatalogEntry.title)}">
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
        html += `
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
      });
    html += `
</div>
`;
  }

  // Translation Words Appendix
  if (rcLinksData.tw && twCatalogEntries?.length) {
    const twCatalogEntry = twCatalogEntries[0];
    html += `
<div class="appendex tw section" id="appendex-tw" data-toc-title="Appendix: ${encodeHTML(twCatalogEntry.title)}">
  <div class="article title-page">
    <span class="header-title"></span>
    <img class="title-logo" src="https://cdn.door43.org/assets/uw-icons/logo-utw-256.png" alt="utw">
    <h1 class="header cover-header section-header">${twCatalogEntry.title} - ${bookTitle}</h1>
    <h3 class="cover-version">${twCatalogEntry.branch_or_tag_name}</h3>
  </div>
`;
    Object.values(rcLinksData.tw)
      .sort((a, b) => (a.title.toLowerCase() < b.title.toLowerCase() ? -1 : a.title.toLowerCase() > b.title.toLowerCase() ? 1 : 0))
      .forEach((twArticle) => {
        html += `
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
      });
    html += `
</div>
`;
  }

  return html;
}
