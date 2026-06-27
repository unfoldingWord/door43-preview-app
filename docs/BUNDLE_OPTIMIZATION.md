# Bundle Optimization Analysis

## Current State (February 2025)

### Bundle Sizes
After attempting to split the monolithic SPA into catalog and viewer apps:

**Full Viewer (index.html):**
- Total: ~4.2 MB uncompressed (~1.2 MB gzipped)
- Breakdown:
  - `vendor-react`: 208 KB (66 KB gzipped)
  - `vendor-mui`: 466 KB (136 KB gzipped)
  - `vendor`: 3,364 KB (962 KB gzipped) - **PROBLEM**
  - `viewer-components`: 75 KB
  - `catalog-components`: 110 KB
  - `main`: 44 KB

**Catalog (catalog.html):**
- Loads: React + MUI + vendor (same as above)
- Total: ~4 MB even for minimal catalog
- **Does NOT achieve the goal of < 300 KB lightweight catalog**

### Root Cause

The 3.3 MB `vendor` bundle contains ALL node_modules dependencies except React and MUI:
- **proskomma** (~1.5 MB) - Bible text processing engine
- **usfm-js** (~300 KB) - USFM parser
- **pagedjs** (~500 KB) - PDF rendering
- **word-aligner-rcl**, **bible-reference-rcl** (200-300 KB) - alignment tools
- Plus dozens of other dependencies

**Why splitting doesn't work:**
1. MUI has transitive dependencies (emotion, babel-runtime, etc.)
2. These MUI dependencies are in `node_modules`, so they go to `vendor` chunk
3. Once `vendor` chunk is referenced, ALL its code is loaded (3.3 MB)
4. Therefore, catalog.html loads the entire vendor bundle even though it only uses MUI's Container and Typography

## Attempted Solutions

### 1. Manual Chunk Splitting (Current)
**Approach**: Configure `vite.config.js` with `manualChunks` to separate:
- `vendor-react` - React core
- `vendor-mui` - Material-UI
- `vendor` - Everything else from node_modules
- `catalog-components` - Catalog UI
- `viewer-components` - Viewer UI

**Result**: ❌ Failed - Catalog still loads all vendor code

### 2. Minimal Catalog Entry Point
**Approach**: Created `catalog-minimal.jsx` that ONLY imports React + MUI, no app components

**Result**: ⚠️ Partial success - Reduced catalog code to 0.58 KB, but still loads 3.3 MB vendor bundle due to MUI dependencies

## Recommendations

### Option A: Dynamic Imports (Quick Win)
Split heavy Bible libraries into separate chunks loaded on-demand:

```javascript
// In Bible.jsx or wherever proskomma is needed
const loadProskomma = () => import('proskomma').then(m => m.default);
const loadUsfmParser = () => import('usfm-js').then(m => m.default);

// Only load when user actually views a Bible project
useEffect(() => {
  if (projectType === 'bible') {
    loadProskomma().then(Proskomma => {
      // Use Proskomma here
    });
  }
}, [projectType]);
```

**Impact**: Initial page load drops from 4.2 MB to ~1.5 MB. Bible libraries load when needed.

**Effort**: 1-2 days - Need to refactor all Bible rendering components

### Option B: Truly Separate Apps (Major Refactor)
Create completely independent applications:

**New Structure:**
```
apps/
  catalog/          # Lightweight catalog browser
    package.json    # Only React, MUI, minimal deps
    src/
      CatalogApp.jsx
      CatalogGrid.jsx
  
  viewer/           # Full project viewer
    package.json    # All Bible libraries
    src/
      ViewerApp.jsx
      Bible.jsx
      OpenBibleStories.jsx
      etc.

packages/
  shared-ui/        # Common UI components
  dcs-api/          # API client
```

**Build**: Two separate Vite builds, deployed to different routes:
- `/catalog/` → Catalog app (~300 KB)
- `/view/` → Viewer app (~1 MB)

**Impact**: True separation, catalog loads only what it needs

**Effort**: 1-2 weeks - Requires monorepo setup, extracting shared code, duplicate infrastructure

### Option C: Keep Monolith, Optimize Chunks (Pragmatic)
Accept the monolithic architecture but split vendor bundle further:

```javascript
manualChunks(id) {
  // Bible processing libraries
  if (id.includes('proskomma') || id.includes('usfm-js')) {
    return 'vendor-bible';
  }
  // PDF rendering
  if (id.includes('pagedjs')) {
    return 'vendor-pdf';
  }
  // Alignment tools
  if (id.includes('word-aligner') || id.includes('bible-reference')) {
    return 'vendor-alignment';
  }
  // React ecosystem
  if (id.includes('react') || id.includes('react-dom')) {
    return 'vendor-react';
  }
  // MUI and its dependencies
  if (id.includes('@mui') || id.includes('@emotion')) {
    return 'vendor-mui';
  }
  // Everything else
  if (id.includes('node_modules')) {
    return 'vendor-utils';
  }
}
```

Then use dynamic imports to load Bible chunks only when needed.

**Impact**: Catalog page still loads ~700 KB (React + MUI + utils), but avoids 2.5 MB of Bible libraries

**Effort**: 3-4 days - Refine chunk splitting, add dynamic imports for Bible components

## Recommended Path Forward

**Phase 1 (Immediate - 1 day):**
1. Revert to single entry point (remove catalog.html experiment)
2. Keep current chunk splitting for clarity
3. Document that full optimization requires dynamic imports

**Phase 2 (Next sprint - 1 week):**
1. Implement Option C: Better chunk splitting + dynamic imports
2. Target: Initial load < 1 MB, Bible libraries load on-demand
3. Measure actual user impact (most users browse catalog then view projects)

**Phase 3 (Future - if needed):**
1. If bundle size is still problematic, consider Option B (separate apps)
2. Requires significant refactoring but achieves true separation

## Current Decision

**Keeping the monolithic SPA** because:
1. Vite's code splitting doesn't provide true isolation for shared dependencies
2. The "catalog app" would still load 700 KB+ due to MUI dependencies
3. Better ROI from dynamic imports of Bible libraries
4. Users typically view projects after browsing catalog (minimal waste)

The multi-entry build configuration is preserved in `vite.config.js` for future exploration.
