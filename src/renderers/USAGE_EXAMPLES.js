/**
 * Translation Notes Renderer - Usage Examples
 * 
 * This file demonstrates how to use the standalone Translation Notes renderer
 * in different contexts: React components, Node.js scripts, and CLI tools.
 */

// ============================================================================
// Example 1: Basic Usage in React Component
// ============================================================================

import { useState, useEffect } from 'react';
import { generateTranslationNotesHtml } from '@renderers/translationNotesRenderer';

function RcTranslationNotes() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ message: '', percent: 0 });

  useEffect(() => {
    const loadTranslationNotes = async () => {
      try {
        const result = await generateTranslationNotesHtml({
          owner: 'unfoldingWord',
          repo: 'en_tn',
          ref: 'master',
          bookId: 'tit',
          catalogEntry: catalogEntryObject, // From DCS catalog API
          authToken: null, // Optional
          onProgress: (message, percent) => {
            setProgress({ message, percent });
          }
        });

        setResult(result);
      } catch (err) {
        setError(err);
      }
    };

    loadTranslationNotes();
  }, []);

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  if (!result) {
    return (
      <div className="loading">
        <div>{progress.message}</div>
        <progress value={progress.percent} max="100" />
      </div>
    );
  }

  return (
    <>
      <style>{result.css.web}</style>
      <div dangerouslySetInnerHTML={{ __html: result.html }} />
    </>
  );
}

// ============================================================================
// Example 2: Node.js Script (Generate HTML for all books)
// ============================================================================

/*
const { generateTranslationNotesHtml } = require('./renderers/translationNotesRenderer');
const fs = require('fs').promises;

async function generateAllBooks() {
  const books = ['gen', 'exo', 'lev', ...]; // All 66 books
  
  for (const bookId of books) {
    console.log(`Generating ${bookId}...`);
    
    const result = await generateTranslationNotesHtml({
      owner: 'unfoldingWord',
      repo: 'en_tn',
      ref: 'master',
      bookId,
      catalogEntry: await fetchCatalogEntry('unfoldingWord', 'en_tn', 'master'),
      onProgress: (msg, pct) => console.log(`  ${pct}% - ${msg}`)
    });

    // Save to file
    await fs.writeFile(
      `output/${bookId}.html`,
      `
<!DOCTYPE html>
<html>
<head>
  <style>${result.css.web}</style>
</head>
<body>
  ${result.html}
</body>
</html>
      `
    );
    
    console.log(`✓ ${bookId} complete`);
  }
}

generateAllBooks().catch(console.error);
*/

// ============================================================================
// Example 3: CLI Tool
// ============================================================================

/*
#!/usr/bin/env node

const { generateTranslationNotesHtml } = require('./renderers/translationNotesRenderer');
const yargs = require('yargs');
const fs = require('fs').promises;

const argv = yargs
  .option('owner', {
    alias: 'o',
    description: 'Repository owner',
    type: 'string',
    default: 'unfoldingWord'
  })
  .option('repo', {
    alias: 'r',
    description: 'Repository name',
    type: 'string',
    default: 'en_tn'
  })
  .option('ref', {
    alias: 'v',
    description: 'Branch or tag',
    type: 'string',
    default: 'master'
  })
  .option('book', {
    alias: 'b',
    description: 'Book ID',
    type: 'string',
    required: true
  })
  .option('output', {
    alias: 'f',
    description: 'Output file path',
    type: 'string',
    required: true
  })
  .help()
  .argv;

async function main() {
  console.log(`Generating Translation Notes for ${argv.book}...`);
  
  // Fetch catalog entry
  const catalogEntry = await fetchCatalogEntry(argv.owner, argv.repo, argv.ref);
  
  // Generate HTML
  const result = await generateTranslationNotesHtml({
    owner: argv.owner,
    repo: argv.repo,
    ref: argv.ref,
    bookId: argv.book,
    catalogEntry,
    onProgress: (msg, pct) => {
      process.stdout.write(`\r${pct}% - ${msg}`.padEnd(80));
    }
  });
  
  console.log('\n\nWriting to file...');
  
  // Write output
  await fs.writeFile(argv.output, `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Translation Notes - ${argv.book}</title>
  <style>${result.css.web}</style>
</head>
<body>
  ${result.html}
</body>
</html>
  `);
  
  console.log(`✓ Complete! Saved to ${argv.output}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

// Usage:
// node generate-tn.js --book tit --output titus.html
// node generate-tn.js -o unfoldingWord -r en_tn -v v86 -b gen -f genesis.html
*/

// ============================================================================
// Example 4: Batch Processing with Caching
// ============================================================================

/*
const { generateTranslationNotesHtml } = require('./renderers/translationNotesRenderer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class TranslationNotesCache {
  constructor(cacheDir = './cache') {
    this.cacheDir = cacheDir;
  }

  getCacheKey(params) {
    const key = `${params.owner}/${params.repo}/${params.ref}/${params.bookId}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  async get(params) {
    const key = this.getCacheKey(params);
    const filePath = path.join(this.cacheDir, `${key}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      return null;
    }
  }

  async set(params, result) {
    const key = this.getCacheKey(params);
    const filePath = path.join(this.cacheDir, `${key}.json`);
    
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(result, null, 2));
  }
}

async function generateWithCache(params) {
  const cache = new TranslationNotesCache();
  
  // Try cache first
  const cached = await cache.get(params);
  if (cached) {
    console.log('✓ Using cached version');
    return cached;
  }
  
  // Generate fresh
  console.log('⚙ Generating fresh version...');
  const result = await generateTranslationNotesHtml(params);
  
  // Cache result
  await cache.set(params, result);
  
  return result;
}
*/

// ============================================================================
// Example 5: Progress Tracking with React
// ============================================================================

/*
function TranslationNotesWithProgress() {
  const [state, setState] = useState({
    html: null,
    error: null,
    stage: '',
    percent: 0
  });

  useEffect(() => {
    generateTranslationNotesHtml({
      owner: 'unfoldingWord',
      repo: 'en_tn',
      ref: 'master',
      bookId: 'tit',
      catalogEntry,
      onProgress: (message, percent) => {
        setState(prev => ({ ...prev, stage: message, percent }));
      }
    })
      .then(result => setState(prev => ({ ...prev, html: result.html })))
      .catch(error => setState(prev => ({ ...prev, error })));
  }, []);

  if (state.error) {
    return <ErrorDisplay error={state.error} />;
  }

  if (!state.html) {
    return (
      <div className="loading-screen">
        <h2>Loading Translation Notes</h2>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${state.percent}%` }} />
        </div>
        <p>{state.stage}</p>
        <small>{state.percent}% complete</small>
      </div>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: state.html }} />;
}
*/

// ============================================================================
// Example 6: Error Handling
// ============================================================================

/*
async function robustGeneration(params) {
  try {
    const result = await generateTranslationNotesHtml(params);
    return { success: true, result };
  } catch (error) {
    console.error('Generation failed:', error);
    
    // Log detailed error info
    console.error('Params:', params);
    console.error('Stack:', error.stack);
    
    // Return error result
    return {
      success: false,
      error: {
        message: error.message,
        type: error.constructor.name,
        params
      }
    };
  }
}
*/

export { RcTranslationNotes };
