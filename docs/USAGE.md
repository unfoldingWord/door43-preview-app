# Door43 Preview — User Guide

How to preview and print Bible translations, translation helps, and Open Bible
Stories from the [Door43 Content Service (DCS)](https://git.door43.org).

> For readers and translators using the app — no technical background needed.
> (Kept up to date as the app develops; developers/operators want
> [OPERATIONS.md](OPERATIONS.md).)

Open it at **[preview.door43.org](https://preview.door43.org)**.

---

## Previewing a resource

1. **Find a resource** — set the **Language** and **Subject** (e.g. Aligned Bible,
   Translation Notes, Open Bible Stories) and click **Find**. Pick a resource from
   the list.
2. **Pick a version** (optional) — the latest published release is used by default.
   Use the version control to switch to a **branch** (work in progress) or an older
   **release/tag**.
3. **Pick a book** — for Bibles and the TSV helps (Notes, Questions, Words Links),
   choose a book; then optionally jump to a chapter/verse.
4. **View it** — **Web** for on-screen reading, or **PDF** for a print-ready
   download.

### Web vs PDF

- **Web** is an interactive page with chapter/verse navigation.
- **PDF** is rendered on the server (page size and columns applied) and can take a
  moment the first time; a progress indicator shows while it builds, then it opens.
  Once built it's saved, so opening it again is immediate.

---

## "Built with" — what your preview was made from

Click the small **chevron on the bottom edge of the header** to slide down the
**Built with** panel. Many previews combine several resources — Translation Notes,
for example, pull in the Literal and Simplified texts, the original-language text,
Translation Academy, and Translation Words. Each card shows one resource:

- its **title** (links to preview that resource on its own),
- its **version** and commit (links to the resource on DCS ↗),
- its **language, owner, and subject**, and
- when it was last **updated** (a branch) or **released** (a tag).

The panel's footer shows which **DCS server** you're reading from (PROD / QA), links
to the main resource's **metadata** and **Book Package** (the JSON that lists all the
pieces), plus this guide and the app version.

---

## How caching works — why it's fast, and when it updates

The app remembers what it has already rendered, so previews are quick and PDFs don't
have to be rebuilt every time.

- **The first view** of a book renders it and saves the result. **Opening it again is
  instant** — for you and for everyone else.
- **A preview is rebuilt only when the content it uses actually changes.** Because a
  preview can depend on several resources, editing a *different* book, or a resource
  this preview doesn't use, won't make it re-render. (This is why the "Built with"
  panel matters — those are exactly the pieces that would trigger an update.)

### Releases vs branches

- **A release (tag, e.g. `v89`) never changes**, so its preview is always served from
  the saved copy — instantly.
- **A branch (e.g. `master`) can change** as people commit work. When you're viewing a
  branch and its source has moved on DCS since the app last rendered it:
  1. You immediately see the **last rendered version** (no waiting), with a banner:
     *"…has changed content — updating the document to apply the changes…"*. The
     banner **names which resource(s) — and which book — changed**.
  2. The app rebuilds the updated version **in the background**.
  3. When it's ready, the preview **refreshes itself** to the latest content.

So you're never blocked waiting on a re-render — you get the last good version at
once and the fresh one as soon as it's built.

---

## Sharing and direct links

Previews are linkable — copy the URL to share exactly what you're viewing:

- **A specific resource/book:** `…/u/<owner>/<repo>/<version>?book=<book>` — e.g.
  `/u/unfoldingWord/en_tn/master?book=tit`. Leave off the version for the latest
  release. Add `&ref=<chapter>:<verse>` to open at a verse.
- **Browse by language:** `/<lang>` (e.g. `/en`).
- **Browse by owner:** `/u/<owner>` (e.g. `/u/unfoldingWord`).
- **Language + owner:** `/<lang>/<owner>` (e.g. `/en/unfoldingWord`).
- **Filter by subject:** add `?subject=<subject>` to any of the above.

These pre-fill the search so you land on the right set of resources.

---

## Getting help

- Something looks wrong in a preview? It usually reflects the upstream content — check
  the resource on DCS via the "Built with" links.
- Report issues or ask questions on the
  [GitHub repository](https://github.com/unfoldingWord-box3/door43-preview-app).
