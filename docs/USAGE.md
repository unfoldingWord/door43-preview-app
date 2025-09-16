# Usage Guide

## Overview
Door43 Preview lets you browse and preview DCS resources (TSV/Markdown/USFM) and print or export to PDF.

## Getting Started
- Open the hosted app: https://preview.door43.org/
- Use the catalog search or subject filters to find resources.
- Select a language and resource, then open the preview.

## Header & Search
- Help: the question-mark icon opens this User Guide on GitHub (hover for tooltip).
- Branch/Tag: click the version chip to open a dropdown.
  - Toggle between Branches and Tags using the tabs.
  - Branches sort alphabetically; Tags sort by version (newest first, e.g., v10.1 before v1.1).
  - The current selection is highlighted and scrolled into view.
- Repository: click the repository chip to switch to another repo from the same owner.
  - Repositories list alphabetically; the current repo is highlighted and scrolled into view.
  - Owner chip opens all of that owner’s resources within this app.
- Search: the magnifying-glass icon opens “Preview a Resource” (hover for tooltip), where you can:
  - Choose Language, Owner (provider), and Repository (resource).
  - Pick the version: Default Branch (latest), a specific Branch, Latest Release (prod), or a Tag.
  - Optionally select a Book for Bible/TSV resources.
  - After selection, the app opens the chosen resource at the selected version.
- Current context: the center header shows `{owner}/{repo}` with a version chip and tooltips (updated/released). The repo link opens the corresponding page on DCS.

## Preview Options
- View modes:
  - Web: interactive reading and navigation.
  - Print: builds a paginated preview optimized for printing/PDF; rendering may take time (see progress bar).
- Print options: open the printer icon to choose size, orientation, and columns, then use your browser print dialog to save as PDF or print.
- Content controls: toggle elements where available (e.g., notes/questions variants).

## Tips
- Large resources may take time to load; keep the tab active.
- Links to related resources are converted where possible.
- For right-to-left content, RTL styles are applied automatically when detected.

## Known Limitations
- No offline mode; an internet connection is required to fetch catalog and content.
- Rendering depends on upstream content quality; unexpected markup can affect layout.

## Support
- Open issues on GitHub or visit the OCE Discord for questions.
