# Architecture Overview

This app renders Door43/DCS resources based on the URL, selecting the correct renderer and producing HTML for web and paged output for printing.

## URL → Resource → Component
- URL pattern: `/u/{owner}/{repo}/{ref}` with optional `#hash` and query params.
- Query params: `server`, `book`, `chapters`, `editor`, `nocache`, `token`, etc.
- AppContext parses the URL, fetches repo + catalog entry, then maps metadata to a renderer:
  - `rc` (Resource Container): Translation Notes/Questions/Words, TA, OBS → `Rc*` components
  - `ts` (translationStudio): Scripture → `TsBible`
  - `tc` (translationCore): Scripture → `Bible`
  - OBS → `OpenBibleStories`

## Data & Rendering Flow
```
URL (/u/owner/repo/ref?book=...#hash)
   ↓ parse (App.context)
DCS API (owner/repo/catalog entry)
   ↓ select
ResourceComponent (Bible, TsBible, Rc* , OBS)
   ↓ generate
helpers/hooks → HTML sections (cover, toc, body) + CSS
   ↓ display
WebPreviewComponent (interactive)
   ↓ paginate
PrintPreviewComponent (paged output → browser print/PDF)
```

## Notable Pieces
- `src/components/App.context.jsx`: URL parsing, DCS fetching, renderer selection.
- `src/components/*`: Renderers like `RcTranslationNotes`, `OpenBibleStories`, `Bible`, `TsBible`.
- `src/helpers/*`: HTML transforms, styles, DCS utilities.
- `src/components/PrintPreviewComponent.jsx`: print/paged preview (uses paged rendering).

## Hash/Anchors and Books
- Hash anchors (e.g., `#gen-1-1`, `#obs-1`) drive in-document navigation.
- `book` query param supports ranges (`ot`, `nt`, `all`, `1-5`, `gen,exo`).

For high-level contributor guidance, see AGENTS.md. For deployment, see docs/DEPLOYMENT.md.
