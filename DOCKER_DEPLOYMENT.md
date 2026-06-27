# Docker Deployment Guide

This document explains how to deploy the Door43 Preview App using Docker.

## Prerequisites

- Docker (20.10+)
- Docker Compose (2.0+)
- Node.js 20+ (for local development)
- pnpm (for local development)

## Quick Start with Docker Compose

1. **Clone the repository and navigate to the project:**
   ```bash
   cd door43-preview-app
   ```

2. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` and add your AWS credentials and configuration:**
   ```bash
   # Edit these values with your actual credentials
   PREVIEW_S3_REGION=us-east-1
   PREVIEW_S3_UPLOAD_ACCESS_KEY_ID=your-upload-key
   PREVIEW_S3_UPLOAD_SECRET_ACCESS_KEY=your-upload-secret
   PREVIEW_S3_DOWNLOAD_ACCESS_KEY_ID=your-download-key
   PREVIEW_S3_DOWNLOAD_SECRET_ACCESS_KEY=your-download-secret
   VITE_PREVIEW_S3_BUCKET_NAME=your-bucket-name
   VITE_PREVIEW_VERIFICATION_KEY=your-verification-key
   ```

4. **Build and start the application:**
   ```bash
   pnpm docker:compose
   ```

5. **Access the application:**
   - Open http://localhost:3000

6. **Stop the application:**
   ```bash
   pnpm docker:compose:down
   ```

## Manual Docker Commands

### Build the Docker image:
```bash
pnpm docker:build
# or directly:
docker build -t door43-preview-app .
```

### Run the container:
```bash
pnpm docker:run
# or directly:
docker run -p 3000:3000 --env-file .env door43-preview-app
```

### Run with custom port:
```bash
docker run -p 8080:3000 --env-file .env door43-preview-app
```

## API Endpoints

The server exposes the following endpoints:

- `GET /health` - Health check endpoint
- `POST /api/cache-html?verification=KEY&path=u/...` - Upload cached HTML to S3
- `GET /api/get-cached-html?owner=X&repo=Y&ref=Z&bookId=W` - Get cached URL from S3
- `GET /*` - Serves the React app (SPA)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (production/development) | Yes |
| `PORT` | Server port (default: 3000) | No |
| `PREVIEW_S3_REGION` | AWS S3 region | Yes |
| `PREVIEW_S3_UPLOAD_ACCESS_KEY_ID` | AWS access key for uploads | Yes |
| `PREVIEW_S3_UPLOAD_SECRET_ACCESS_KEY` | AWS secret key for uploads | Yes |
| `PREVIEW_S3_DOWNLOAD_ACCESS_KEY_ID` | AWS access key for downloads | Yes |
| `PREVIEW_S3_DOWNLOAD_SECRET_ACCESS_KEY` | AWS secret key for downloads | Yes |
| `VITE_PREVIEW_S3_BUCKET_NAME` | S3 bucket name | Yes |
| `VITE_PREVIEW_VERIFICATION_KEY` | Verification key for uploads | Yes |

## Development

For local development without Docker:

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start the Vite dev server (frontend):**
   ```bash
   pnpm dev
   ```

3. **Start the Node.js server (backend) in another terminal:**
   ```bash
   pnpm dev:server
   ```

4. **Update your app to use local API endpoints:**
   - Change API calls from `/.netlify/functions/` to `http://localhost:3000/api/`

## Production Deployment

### Deploy to any server with Docker:

1. Copy files to server
2. Create `.env` file with production values
3. Run `docker-compose up -d`
4. Set up reverse proxy (nginx/traefik) if needed for HTTPS

### Deploy to Kubernetes:

Create a Kubernetes deployment using the Docker image. Example:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: door43-preview-app
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: app
        image: door43-preview-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: door43-preview-secrets
```

## Troubleshooting

### Container won't start:
- Check logs: `docker logs <container-id>`
- Verify `.env` file exists and has correct values
- Ensure port 3000 is not already in use

### API calls failing:
- Check that AWS credentials are correct
- Verify S3 bucket permissions
- Check server logs for detailed error messages

### Health check failing:
- Container may still be starting (wait 30-40 seconds)
- Check if port 3000 is accessible inside container
- Review server logs

## Migrating from Netlify

The main changes from Netlify deployment:

1. **Functions → Express Routes:**
   - `/.netlify/functions/save-html-to-cache` → `/api/save-html-to-cache`
   - `/.netlify/functions/get-cached-html` → `/api/get-cached-html`

2. **Update frontend API calls:**
   ```javascript
   // Old (Netlify)
   fetch('/.netlify/functions/cache-html', ...)
   
   // New (Docker)
   fetch('/api/cache-html', ...)
   ```

3. **Environment variables:**
   - Still use `.env` file
   - `VITE_*` variables are still built into the frontend
   - Server-only secrets are kept secure in backend

4. **Deployment:**
   - No more Netlify builds
   - Use Docker instead
   - Can deploy anywhere Docker runs
