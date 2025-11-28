# Door43 Preview Renderers

Standalone JavaScript libraries for generating HTML from Bible translation resources hosted on git.door43.org.

## Architecture Overview

This directory contains **framework-agnostic HTML renderers** that can be used independently of React or any UI framework. Each renderer is a pure JavaScript module that:

1. Fetches raw content from DCS (Door43 Content Service)
2. Processes and transforms the data
3. Generates complete HTML output
4. Returns structured results with metadata

## Available Renderers

### 1. Translation Notes (`translationNotesRenderer.js`)
Generates HTML for Translation Notes with integrated Bible verses, Translation Words links, and Translation Academy articles.

**Usage:**
```javascript
import { generateTranslationNotesHtml } from './renderers/translationNotesRenderer';

const result = await generateTranslationNotesHtml({
  owner: 'unfoldingWord',
  repo: 'en_tn',
  ref: 'master',
  bookId: 'gen',
  catalogEntry: catalogEntryObject,
  authToken: 'optional-dcs-token',
  onProgress: (message, percent) => console.log(message, percent)
});

// result = { html, css: {web, print}, builtWith }
```

### 2. Open Bible Stories (`obsRenderer.js`)
Generates HTML for OBS (Open Bible Stories) with images and narrative text.

**Status:** 🚧 In Development

### 3. Bible (`bibleRenderer.js`)
Generates HTML for Bible texts (USFM format).

**Status:** 📋 Planned

### 4. Translation Questions (`translationQuestionsRenderer.js`)
Generates HTML for Translation Questions.

**Status:** 📋 Planned

### 5. Translation Words (`translationWordsRenderer.js`)
Generates HTML for Translation Words dictionary entries.

**Status:** 📋 Planned

### 6. Translation Academy (`translationAcademyRenderer.js`)
Generates HTML for Translation Academy training articles.

**Status:** 📋 Planned

## Common API Pattern

All renderers follow a consistent API:

```javascript
async function generateResourceHtml({
  owner,           // Repository owner (e.g., 'unfoldingWord')
  repo,            // Repository name (e.g., 'en_tn')
  ref,             // Branch or tag (e.g., 'master', 'v86')
  bookId,          // Book identifier (e.g., 'gen', 'tit')
  catalogEntry,    // DCS catalog entry object
  authToken,       // Optional auth token for private repos
  renderOptions,   // Renderer-specific options
  onProgress       // Progress callback (message, percent)
})
```

**Returns:**
```javascript
{
  html: '<html>...</html>',      // Generated HTML string
  css: {
    web: '...',                   // CSS for web preview
    print: '...'                  // CSS for print/PDF
  },
  builtWith: {                    // Metadata about resources used
    primary: catalogEntry,
    related: [...]
  }
}
```

## Integration with React App

The React components now act as **thin wrappers** around these renderers:

### Before (Hook Hell 😱):
```javascript
// 15+ hooks, complex dependency chains, re-render nightmares
const data1 = useFetch1(...);
const data2 = useFetch2(data1, ...);
const data3 = useFetch3(data2, ...);
// ... 12 more hooks
const html = useGenerate(data15);
```

### After (Clean & Simple 😊):
```javascript
import { generateTranslationNotesHtml } from '@renderers/translationNotesRenderer';

function RcTranslationNotes() {
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    generateTranslationNotesHtml({...params})
      .then(result => setHtml(result.html))
      .catch(err => setError(err));
  }, [params]);
  
  if (error) return <Error>{error}</Error>;
  if (!html) return <Loading />;
  return <div dangerouslySetInnerHTML={{__html: html}} />;
}
```

## Benefits

### 🎯 Separation of Concerns
- **Renderers**: Pure data processing logic
- **React**: UI, navigation, print preview
- **Hooks**: Only for React-specific state management

### 📦 Reusability
- Use renderers in Node.js scripts
- Create CLI tools for batch processing
- Build browser extensions
- Integrate with other frameworks (Vue, Angular, etc.)

### 🧪 Testability
- Pure functions are easy to unit test
- No React dependency = faster tests
- Mock DCS API calls easily

### 🚀 Performance
- Eliminates re-render cascades
- Better caching strategies
- Parallel data fetching with Promise.all
- Progress tracking for long operations

### 📚 NPM Package Ready
Each renderer can be extracted into its own NPM package:
```bash
npm install @door43/translation-notes-renderer
npm install @door43/obs-renderer
npm install @door43/bible-renderer
```

## Development Status

| Renderer | Status | Progress |
|----------|--------|----------|
| Translation Notes | 🚧 In Progress | 60% |
| OBS | 📋 Planned | 0% |
| Bible | 📋 Planned | 0% |
| Translation Questions | 📋 Planned | 0% |
| Translation Words | 📋 Planned | 0% |
| Translation Academy | 📋 Planned | 0% |

## Migration Plan

1. ✅ Create `/src/renderers` directory
2. 🚧 Complete `translationNotesRenderer.js`
3. 📋 Create `obsRenderer.js`
4. 📋 Create `bibleRenderer.js`
5. 📋 Refactor React components to use renderers
6. 📋 Remove old hooks
7. 📋 Extract renderers to separate NPM packages

## Contributing

When adding a new renderer:

1. Follow the common API pattern
2. Include comprehensive JSDoc comments
3. Add progress tracking with `onProgress` callback
4. Return structured result with `html`, `css`, and `builtWith`
5. Handle errors gracefully
6. Use Promise.all for parallel operations
7. Add tests (when test infrastructure is ready)

## License

MIT License - See LICENSE file for details
