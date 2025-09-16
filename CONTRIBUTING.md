# Contributing

Thank you for your interest in improving Door43 Preview.

- Read AGENTS.md for repository guidelines (structure, style, commands, PR checklist).
- Discuss feature ideas or report bugs via GitHub Issues.

## Workflow
- Fork and branch: `git checkout -b feature/short-description`
- Install: `pnpm install`
- Dev server: `pnpm dev`
- Lint: `pnpm lint` (fix issues before pushing)
- Build/verify: `pnpm build && pnpm preview`

## Commit Messages
- Use concise, imperative subject lines (e.g., "Add editor mode", "Fix code blocks").
- Reference related issues when applicable.

## Pull Requests
- Provide summary, linked issues, and testing steps.
- Include screenshots/GIFs for UI changes.
- Note any `.env` or configuration changes.
- Ensure lint passes and production build succeeds locally.
