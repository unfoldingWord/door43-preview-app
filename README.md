# Door43 Preview

![unfoldingWord](images/uW.png)

[![Node >= 22](https://img.shields.io/badge/Node-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm >= 10](https://img.shields.io/badge/pnpm-%3E%3D10-f69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![React 18](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=061d2a)](https://react.dev/)
[![Vite 7](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

### Web & Print Preview for Door43 Content Service

A React application for previewing and printing Bible translations, study resources, and Open Bible Stories from the [Door43 Content Service (DCS)](https://qa.door43.org). Generate web previews for online viewing or print-ready PDFs with customizable layouts.

**Live App:** [https://preview.door43.org](https://preview.door43.org)

[Report Bug](https://github.com/unfoldingWord-box3/door43-preview-app/issues) · 
[Request Feature](https://github.com/unfoldingWord-box3/door43-preview-app/issues)

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Quick Start](#quick-start)
- [Development](#development)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Running Locally](#running-locally)
  - [Building for Production](#building-for-production)
- [Docker Deployment](#docker-deployment)
  - [Using Docker Compose](#using-docker-compose)
  - [Using Docker CLI](#using-docker-cli)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## About

Door43 Preview is a web application that fetches Bible translations, translation notes, translation words, study questions, and Open Bible Stories from the Door43 Content Service (DCS) and renders them in two modes:

- **Web Preview**: Interactive, responsive view for online browsing
- **Print Preview**: Paginated layout optimized for printing to PDF with configurable page size, orientation, and column layout

Built with React 18 + Vite 7, the app uses [Proskomma](https://github.com/Proskomma/proskomma-core) for Scripture processing and [PagedJS](https://pagedjs.org/) for print rendering.

![Door43 Preview Screenshot](./images/screenshot.png)

---

## Features

- **Resource Browsing**: Search and browse DCS resources by language, subject, and repository
- **Multi-Format Support**: Bible text (USFM), Open Bible Stories (markdown), Translation Notes/Questions/Words, Translation Academy
- **Web Preview**: Responsive viewer with chapter/verse navigation
- **Print Preview**: Professional print layouts with configurable:
  - Page size (A4, Letter, Legal, etc.)
  - Orientation (Portrait/Landscape)
  - Column count (1-3 columns)
  - Export to PDF via browser print dialog
- **Caching**: Local filesystem caching for improved performance
- **Docker Ready**: Self-hosted deployment with Docker + Docker Compose

---

## Quick Start

**Visit the hosted app:** [https://preview.door43.org](https://preview.door43.org)

1. Browse or search resources by subject (Bible, OBS, Notes, etc.) and language
2. Select a resource to preview
3. Choose **Web Preview** for online viewing or **Print Preview** for PDF export
4. Configure print options and use your browser's print function to save as PDF

For local development, see the [Development](#development) section below.

---

## Development

### Prerequisites

- **Node.js**: >= 22.x (LTS recommended - use [nvm](https://github.com/nvm-sh/nvm) or download from [nodejs.org](https://nodejs.org/))
- **pnpm**: >= 10.x (install via `npm install -g pnpm` or `corepack enable`)
- **Docker** (optional, for containerized deployment)

### Environment Configuration

Copy the example environment file and configure variables:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Server-side variables (used by Express at runtime)
PORT=3000                           # Server port
CACHE_DIR=./cached-files            # Directory for cached content

# DCS API token - allows access to public DCS repos that require authentication
# Create a dummy DCS user with no repos and generate a token with "public_repo" (read-only) scope
# Leave empty if all resources you need are publicly accessible without authentication
DCS_READ_ONLY_TOKEN=

# Verification key - shared secret between client and server
# Client sends this key with cache upload requests; server validates before accepting uploads
# Use any random string (e.g., openssl rand -hex 32)
# This prevents unauthorized users from uploading arbitrary cached content
PREVIEW_VERIFICATION_KEY=
```

**Note:** All configuration is provided to the React client at runtime via the `/api/config` endpoint. No build-time environment variables are needed.

### Running Locally

#### Development Mode (Hot Reload)

Start the Vite development server with hot module replacement:

```bash
pnpm install
pnpm dev
```

**Access:** http://localhost:5173

The dev server proxies API requests to `http://localhost:3000` (if you run the backend separately for testing caching features).

#### Development with Backend (Optional)

To test caching and server-side features, run both frontend and backend:

```bash
# Terminal 1: Start Express server
pnpm dev:server

# Terminal 2: Start Vite dev server
pnpm dev
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000

### Building for Production

#### 1. Build the React App

```bash
pnpm build
```

This creates optimized production assets in `dist/`:
- Single JavaScript bundle (~4.3 MB, ~1.2 MB gzipped)
- CSS, fonts, and static assets
- Hashed filenames for cache busting

#### 2. Preview the Production Build

```bash
pnpm preview
```

**Access:** http://localhost:4173

This serves the built `dist/` folder for testing.

#### 3. Run Production Server

Start the Express server to serve the built app:

```bash
pnpm start
```

**Access:** http://localhost:3000

The Express server:
- Serves static files from `dist/`
- Provides API endpoints for caching (`/api/save-html-to-cache`, `/api/get-cached-html`)
- Handles SPA routing (all routes return `index.html`)

---

## Docker Deployment

The app is containerized using Docker with Chainguard's security-hardened Node base image.

### Using Docker Compose (Recommended)

Docker Compose manages the entire stack with proper environment variable handling and volume mounting.

#### 1. Configure Environment

Ensure your `.env` file contains the required variables:

```bash
# Get a DCS token by:
# 1. Create a dummy DCS user at https://qa.door43.org
# 2. Go to Settings > Applications > Generate New Token
# 3. Select "public_repo" scope (read-only access to public repositories)
# 4. Copy the token here
DCS_READ_ONLY_TOKEN=your_dcs_token_here

# Generate a random verification key (any random string):
# openssl rand -hex 32
PREVIEW_VERIFICATION_KEY=your_random_verification_key_here
```

#### 2. Build and Run

```bash
# Build and start in detached mode
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop and remove containers
docker-compose down
```

**Access:** http://localhost:3000

#### 3. Docker Compose Configuration

The `docker-compose.yml` file:
- Builds the Docker image (no build args needed - everything is runtime)
- Sets runtime environment variables for Express server
- Mounts `./cached-files` as a volume for persistent caching
- Exposes port 3000
- Includes health check (`/health` endpoint)

### Using Docker CLI

For manual Docker builds without Compose:

#### 1. Build the Image

```bash
docker build -t door43-preview-app .
```

**No build arguments needed!** All configuration is provided at runtime.

#### 2. Run the Container

```bash
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e CACHE_DIR=/app/cached-files \
  -e DCS_READ_ONLY_TOKEN="${DCS_READ_ONLY_TOKEN}" \
  -e PREVIEW_VERIFICATION_KEY="${PREVIEW_VERIFICATION_KEY}" \
  -v "$(pwd)/cached-files:/app/cached-files" \
  --name door43-preview \
  door43-preview-app
```

**Runtime Environment Variables:**
- `NODE_ENV=production`: Enables production mode
- `PORT=3000`: Server port
- `CACHE_DIR=/app/cached-files`: Cache directory path
- `DCS_READ_ONLY_TOKEN`: Optional DCS API token for accessing authenticated repos (create a dummy DCS user with public_repo read-only scope)
- `PREVIEW_VERIFICATION_KEY`: Shared secret for validating cache upload requests (prevents unauthorized uploads)

#### 3. Manage the Container

```bash
# View logs
docker logs -f door43-preview

# Stop container
docker stop door43-preview

# Remove container
docker rm door43-preview

# View container details
docker inspect door43-preview
```

### Docker Image Details

- **Base Image**: `cgr.dev/chainguard/node:latest` (currently Node.js 25.x, security-hardened, minimal attack surface)
- **Node Version Note**: Chainguard only provides `:latest` tag (no version-specific tags like `:22`). Currently points to Node 25, which is compatible with this app. Local development uses Node 22 LTS (see `.nvmrc`).
- **Image Size**: ~552 MB
- **Build Process**: Single-stage build with no secrets required at build time
- **Non-root User**: Runs as unprivileged user for security
- **Configuration**: All settings provided at runtime via environment variables
- **Health Check**: `GET /health` returns `{"status":"ok","timestamp":"..."}`

---

## Project Structure

```
door43-preview-app/
├── src/                          # React application source
│   ├── components/               # React components
│   ├── hooks/                    # Custom React hooks
│   ├── helpers/                  # Utility functions
│   ├── renderer/                 # Content rendering logic
│   ├── App.jsx                   # Root component
│   └── main.jsx                  # Entry point
├── server/                       # Express backend
│   ├── index.js                  # Server entry point
│   └── routes/                   # API route handlers
│       ├── save-html-to-cache.js
│       ├── get-cached-html.js
│       └── serve-cached-page.js
├── public/                       # Static assets
├── dist/                         # Production build output (generated)
├── cached-files/                 # Cache storage (gitignored)
├── docs/                         # Additional documentation
│   ├── USAGE.md                  # User guide
│   └── DEPLOYMENT.md             # Deployment details
├── Dockerfile                    # Docker image definition
├── docker-compose.yml            # Docker Compose configuration
├── vite.config.js                # Vite build configuration
├── package.json                  # Dependencies and scripts
├── .env.example                  # Environment variable template
├── AGENTS.md                     # Contributor guidelines
└── ARCHITECHTURE.md              # Architecture documentation
```

### Key Files

- **`vite.config.js`**: Build configuration, path aliases, CommonJS options
- **`server/index.js`**: Express server, API routes, SPA fallback
- **`Dockerfile`**: Multi-stage build with Chainguard Node base
- **`docker-compose.yml`**: Orchestration with build args and volumes
- **`.env.example`**: Template showing required/optional environment variables

---

## Available Scripts

```bash
# Development
pnpm dev                # Start Vite dev server (port 5173)
pnpm dev:server         # Start Express server only (port 3000)

# Building
pnpm build              # Build React app for production
pnpm preview            # Preview production build (port 4173)

# Production
pnpm start              # Run Express server with built assets (port 3000)

# Quality
pnpm lint               # Run ESLint (fails on errors, allows warnings)

# Docker
pnpm docker:build       # Build Docker image with build args
pnpm docker:compose     # Start with Docker Compose
```

---

## API Endpoints

The Express server provides these endpoints:

### Health Check
```
GET /health
Response: {"status":"ok","timestamp":"2025-12-04T..."}
```

### Client Configuration
```
GET /api/config
Response: {
  "dcsReadOnlyToken": "...",      // DCS API token for accessing authenticated repos
  "previewVerificationKey": "..." // Shared secret for cache upload verification
}
Purpose: Provides runtime environment variables to the React client.
         Client uses dcsReadOnlyToken for DCS API requests.
         Client sends previewVerificationKey with cache uploads for validation.
```

### Save Cached HTML
```
POST /api/save-html-to-cache?path=u/owner/repo/ref/book.json.gz&verification=KEY
Body: Gzipped JSON data (binary)
Response: {"message":"Cache Success","path":"..."}
Note: The 'verification' parameter must match PREVIEW_VERIFICATION_KEY.
      This prevents unauthorized cache uploads from untrusted clients.
```

### Get Cached HTML
```
GET /api/get-cached-html?path=u/owner/repo/ref/book.json.gz
Response: {"cached":true,"data":{...}} or {"cached":false}
```

### Fast-Path Cached Page
```
GET /api/cached-page/:owner/:repo/:ref?
Response: Cached book data or 404
```

---

## Contributing

Contributions are welcome! See [AGENTS.md](./AGENTS.md) for contributor guidelines including:
- Coding style and conventions
- Commit message format
- Pull request checklist
- Testing guidelines

For component development process, see the [RCL development guidelines](https://forum.door43.org/t/rcl-app-development-process/605).

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Install dependencies (`pnpm install`)
4. Make your changes
5. Run linter (`pnpm lint`)
6. Build and test (`pnpm build && pnpm preview`)
7. Commit changes (`git commit -m 'Add amazing feature'`)
8. Push to branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

---

## Support

Having trouble? Get help in the official [Open Components Ecosystem Discord](https://discord.com/channels/867746700390563850/1019675732324143205).

---

## Key Technologies

- **React 18**: UI framework with hooks and context
- **Vite 7**: Build tool and dev server
- **Express 4**: Backend server for API and static serving
- **Proskomma**: Scripture processing engine
- **PagedJS**: CSS pagination for print layouts
- **Material-UI 5**: Component library
- **Docker + Chainguard**: Secure containerized deployment

---

## License

Distributed under the MIT License. See [LICENSE](./LICENSE) for more information.

---

## Links

- **Live App**: https://preview.door43.org
- **DCS**: https://qa.door43.org
- **GitHub**: https://github.com/unfoldingWord-box3/door43-preview-app
- **Issues**: https://github.com/unfoldingWord-box3/door43-preview-app/issues
- **Discord**: https://discord.com/channels/867746700390563850/1019675732324143205

