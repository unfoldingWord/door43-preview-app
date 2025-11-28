# Testing Guide for Refactored Components

## What Changed

We've successfully integrated the refactored components into the app:

1. **App.context.jsx** now imports:
   - `OpenBibleStoriesRefactored` instead of `OpenBibleStories`
   - `RcTranslationNotesRefactored` instead of `RcTranslationNotes`

2. The old components are still in the codebase but are **no longer being used**.

3. Both refactored components use standalone renderers from `/src/renderers/`:
   - `translationNotesRenderer.js`
   - `obsRenderer.js`

## Quick Start Testing

### 1. Start the Development Server

```bash
pnpm dev
```

This will start Vite dev server (usually on http://localhost:5173).

### 2. Test Translation Notes

**URL Pattern:**
```
http://localhost:5173/#owner={owner}&repo={repo}&ref={branch}&resource={resource}&book={book}
```

**Test with unfoldingWord English Translation Notes for Titus:**
```
http://localhost:5173/#owner=unfoldingWord&repo=en_tn&ref=master&resource=tn&book=tit
```

**What to Verify:**
- ✅ Page loads without errors
- ✅ Progress messages appear (should see "Fetching X... - Y% complete")
- ✅ Translation Notes render with:
  - Chapter/verse references
  - Support reference (from original language Bible)
  - Translation notes text
  - Embedded Translation Academy articles
  - Embedded Translation Words definitions
  - Table of Contents
- ✅ No console errors
- ✅ No infinite loops (old problem)
- ✅ Performance is good (parallel fetching)

**Expected Output:**
```
TITUS Translation Notes
unfoldingWord® | Door43®

Support Reference:
[Greek text from ULT]

Translation Text:
[English text from ULT]

Chapter 1
Verse 1
[Translation note for Titus 1:1]
[Links to TA articles and TW words]

... (continues for all verses)

Appendix
Translation Academy Articles
Translation Words
```

### 3. Test Open Bible Stories

**Test with unfoldingWord English OBS:**
```
http://localhost:5173/#owner=unfoldingWord&repo=en_obs&ref=master&resource=obs
```

**What to Verify:**
- ✅ Page loads without errors
- ✅ All 50 stories render
- ✅ Images display correctly
- ✅ Image resolution selector works (360px, 2160px)
- ✅ Story titles and text render
- ✅ Progress tracking works
- ✅ No console errors

**Expected Output:**
```
Open Bible Stories
unfoldingWord® | Door43®

1. The Creation
[Image 01-01]
This is how the beginning of everything happened...
[Image 01-02]
...

... (50 stories total)
```

### 4. Test Other Languages

**Spanish Translation Notes (Titus):**
```
http://localhost:5173/#owner=es-419_gl&repo=es-419_tn&ref=master&resource=tn&book=tit
```

**French OBS:**
```
http://localhost:5173/#owner=unfoldingWord&repo=fr_obs&ref=master&resource=obs
```

## Detailed Testing Checklist

### Translation Notes

| Feature | Test | Status |
|---------|------|--------|
| **Basic Rendering** | Page loads and displays | ⬜ |
| **Progress Tracking** | Status messages show during load | ⬜ |
| **Support Reference** | Original language text appears | ⬜ |
| **Translation Text** | Target language text appears | ⬜ |
| **Chapter/Verse** | All chapters and verses render | ⬜ |
| **Translation Notes** | Note text appears under verses | ⬜ |
| **TA Links** | Links to Translation Academy work | ⬜ |
| **TW Links** | Links to Translation Words work | ⬜ |
| **TA Appendix** | Articles appear in appendix | ⬜ |
| **TW Appendix** | Word definitions in appendix | ⬜ |
| **Table of Contents** | TOC renders correctly | ⬜ |
| **Bible Reference** | Can navigate to different books | ⬜ |
| **Print View** | Print layout works | ⬜ |
| **No Errors** | Console is clean | ⬜ |
| **Performance** | Loads reasonably fast | ⬜ |

### Open Bible Stories

| Feature | Test | Status |
|---------|------|--------|
| **Basic Rendering** | Page loads and displays | ⬜ |
| **Progress Tracking** | Status messages show during load | ⬜ |
| **All Stories** | 50 stories render | ⬜ |
| **Images** | Images display correctly | ⬜ |
| **Image Resolution** | Selector changes image quality | ⬜ |
| **Story Titles** | Titles appear | ⬜ |
| **Story Text** | Narrative text renders | ⬜ |
| **Chapter Selection** | Can select specific chapters | ⬜ |
| **Print View** | Print layout works | ⬜ |
| **No Errors** | Console is clean | ⬜ |
| **Performance** | Loads reasonably fast | ⬜ |

## Browser Console Testing

Open DevTools (F12) and check:

### 1. Network Tab
- Look for parallel requests (should see multiple requests at once)
- Verify no failed requests (404s)
- Check timing (parallel fetching should be faster)

### 2. Console Tab
- Should see progress messages
- No red error messages
- No warnings about infinite loops
- No "Maximum update depth exceeded" errors (the old bug!)

### 3. Performance Tab
- Record a trace while loading
- Look for reasonable render times
- No infinite loops or excessive re-renders

## Regression Testing

**Before refactoring, these were broken:**

| Issue | Test | Fixed? |
|-------|------|--------|
| Infinite loops in quote generation | Load TN for Titus, check console for excessive renders | ⬜ |
| Slow sequential loading | Check Network tab - should see parallel requests | ⬜ |
| Complex hook dependencies | Component is simpler, easier to debug | ⬜ |
| Cannot reuse logic | Renderers work standalone (see Unit Tests) | ⬜ |

## Unit Testing the Renderers

You can test the renderers directly in Node.js or browser console:

### Translation Notes Renderer (Node.js)

```javascript
// test-tn-renderer.js
import { generateTranslationNotesHtml } from './src/renderers/translationNotesRenderer.js';

const result = await generateTranslationNotesHtml({
  owner: 'unfoldingWord',
  repo: 'en_tn',
  ref: 'master',
  bookId: 'tit',
  onProgress: (message, percent) => {
    console.log(`${message} - ${percent}%`);
  }
});

console.log('HTML length:', result.html.length);
console.log('Built with:', result.builtWith);
console.log('CSS present:', !!result.css);
```

Run:
```bash
node --experimental-modules test-tn-renderer.js
```

### OBS Renderer (Node.js)

```javascript
// test-obs-renderer.js
import { generateOpenBibleStoriesHtml } from './src/renderers/obsRenderer.js';

const result = await generateOpenBibleStoriesHtml({
  owner: 'unfoldingWord',
  repo: 'en_obs',
  ref: 'master',
  resolution: '360px',
  onProgress: (message, percent) => {
    console.log(`${message} - ${percent}%`);
  }
});

console.log('HTML length:', result.html.length);
console.log('Built with:', result.builtWith);
console.log('Story count:', result.html.match(/<h1/g).length);
```

Run:
```bash
node --experimental-modules test-obs-renderer.js
```

## Browser Console Testing

You can also test renderers directly in the browser console:

```javascript
// Open DevTools Console and paste:

// Test TN Renderer
const { generateTranslationNotesHtml } = await import('/src/renderers/translationNotesRenderer.js');

const tnResult = await generateTranslationNotesHtml({
  owner: 'unfoldingWord',
  repo: 'en_tn',
  ref: 'master',
  bookId: 'tit',
  onProgress: (msg, pct) => console.log(`${msg} - ${pct}%`)
});

console.log('TN HTML:', tnResult.html.substring(0, 500));

// Test OBS Renderer
const { generateOpenBibleStoriesHtml } = await import('/src/renderers/obsRenderer.js');

const obsResult = await generateOpenBibleStoriesHtml({
  owner: 'unfoldingWord',
  repo: 'en_obs',
  ref: 'master',
  resolution: '360px',
  onProgress: (msg, pct) => console.log(`${msg} - ${pct}%`)
});

console.log('OBS HTML:', obsResult.html.substring(0, 500));
```

## Known Test Resources

### Translation Notes (tn)
| Owner | Repo | Language | Notes |
|-------|------|----------|-------|
| unfoldingWord | en_tn | English | Complete, well-tested |
| unfoldingWord | fr_tn | French | Good for i18n testing |
| es-419_gl | es-419_tn | Spanish | Latin American Spanish |
| Door43-Catalog | hi_tn | Hindi | RTL testing |

### Open Bible Stories (obs)
| Owner | Repo | Language | Notes |
|-------|------|----------|-------|
| unfoldingWord | en_obs | English | Complete, well-tested |
| unfoldingWord | fr_obs | French | Good for i18n testing |
| unfoldingWord | es-419_obs | Spanish | Latin American Spanish |

### Test Books
| Book | ID | Why Test |
|------|-----|----------|
| Titus | tit | Small, complete, well-formed |
| Philemon | phm | Smallest NT book |
| Ruth | rut | Small OT book |
| Matthew | mat | Large, complex |

## Performance Benchmarks

**Before Refactoring:**
- Translation Notes (Titus): ~15-20 seconds (sequential loading)
- Many re-renders due to hook cascades
- Frequent infinite loops

**After Refactoring (Expected):**
- Translation Notes (Titus): ~5-8 seconds (parallel loading)
- Single render per component
- No infinite loops

**To Measure:**
1. Open DevTools → Performance tab
2. Click Record
3. Load the resource
4. Stop recording
5. Check:
   - Total time
   - Number of React renders
   - Network waterfall (should be parallel)

## Troubleshooting

### Issue: "Module not found: @renderers/..."

**Solution:** Check `vite.config.js` has the alias:
```javascript
resolve: {
  alias: {
    '@renderers': path.resolve(__dirname, './src/renderers'),
    // ... other aliases
  }
}
```

### Issue: Progress messages don't appear

**Solution:** Check that `onProgress` callback is being called in renderer and component is updating state.

### Issue: Images don't load in OBS

**Solution:** 
1. Check network tab for 404s
2. Verify image URLs are correct
3. Check resolution parameter

### Issue: Translation Academy/Words not appearing

**Solution:**
1. Check console for fetch errors
2. Verify relation catalog entries exist
3. Check that DCS API is accessible

### Issue: Infinite loops are back

**Solution:**
1. This shouldn't happen with renderers!
2. Check if old components are being used
3. Verify App.context.jsx imports refactored versions

## Success Criteria

### Minimum (MVP)
- ✅ Both refactored components load without errors
- ✅ Content renders correctly
- ✅ No infinite loops
- ✅ No console errors

### Good
- ✅ Performance is better than before
- ✅ Progress tracking works
- ✅ Multiple books/languages work
- ✅ Print view works

### Excellent
- ✅ All features work perfectly
- ✅ Significant performance improvement
- ✅ Code is maintainable
- ✅ Ready to refactor remaining components

## Next Steps After Testing

1. **If tests pass:** 
   - Document any issues found
   - Create refactored versions of other components:
     - Bible.jsx → BibleRefactored.jsx
     - RcTranslationQuestions.jsx → RcTranslationQuestionsRefactored.jsx
     - RcTranslationWords.jsx → RcTranslationWordsRefactored.jsx
     - RcTranslationAcademy.jsx → RcTranslationAcademyRefactored.jsx

2. **If tests fail:**
   - Document exact failure scenario
   - Check renderer logic vs original hook logic
   - Add debug logging to renderers
   - Fix issues and re-test

3. **After all components work:**
   - Delete old component files
   - Extract renderers to NPM package
   - Add comprehensive unit tests
   - Update documentation

## Questions to Answer

After testing, please document:

1. **Performance:**
   - How long does TN for Titus take to load?
   - How does it compare to the old version?
   - Are requests parallel?

2. **Correctness:**
   - Does the output match the old version?
   - Are all features working?
   - Any missing content?

3. **User Experience:**
   - Are progress messages helpful?
   - Is the UI responsive during loading?
   - Are error messages clear?

4. **Code Quality:**
   - Is the component code easier to understand?
   - Would it be easy to fix a bug?
   - Could someone new understand it?

## Test Report Template

```markdown
# Test Report: Refactored Components

Date: ___________
Tester: ___________

## Translation Notes
- URL Tested: ___________
- Load Time: ___________
- Issues Found: ___________
- Console Errors: ___________
- Overall: ✅ PASS / ❌ FAIL

Notes:
___________

## Open Bible Stories
- URL Tested: ___________
- Load Time: ___________
- Issues Found: ___________
- Console Errors: ___________
- Overall: ✅ PASS / ❌ FAIL

Notes:
___________

## Performance Comparison
- TN Before: ___________
- TN After: ___________
- OBS Before: ___________
- OBS After: ___________

## Recommendation
- [ ] Ready for production
- [ ] Needs minor fixes
- [ ] Needs major work
- [ ] Revert changes

Details:
___________
```

---

**Ready to test!** Start the dev server and try the URLs above. 🚀
