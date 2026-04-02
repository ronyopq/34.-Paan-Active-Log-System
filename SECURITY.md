# Security Policy & Deployment Notes

## Overview
PAMS currently uses client-side demo authentication, Azure PostgreSQL for remote app state, and Azure Blob Storage for uploads. This document captures the protections already in place and the remaining production risks.

## Protected Endpoints
- `POST /api/state`
- `POST /api/upload`

Write requests are accepted when one of these is true:
- request comes from localhost during local development
- request is a same-origin browser request from the configured site URL
- request includes `Authorization: Bearer {API_WRITE_TOKEN}`

Set `APP_BASE_URL` in production so same-origin validation is explicit.

## Required Production Environment Variables
```env
DATABASE_URL=postgresql://user:password@host:5432/pams?sslmode=require
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=youraccount;AccountKey=yourkey;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER=activities
APP_BASE_URL=https://yourdomain.com
API_WRITE_TOKEN=your_strong_token
NEXT_PUBLIC_DATA_MODE=remote
DATABASE_POOL_MAX=5
```

## Database Security
- App state is stored server-side through `DATABASE_URL`
- SSL is enabled automatically when `sslmode=require` is present or when running in production
- The `app_state` table is created automatically if missing

## File Upload Security
- Uploads are limited to JPEG, PNG, WEBP, PDF, DOCX, XLSX, and CSV
- Maximum upload size is 10 MB
- File names are sanitized before storage
- Files are served through `/api/file` so the blob container can remain private

## Current Limitations
- Authentication is still demo-only and stored in browser state
- There is no rate limiting on write endpoints yet
- A forged non-browser request could still mimic origin headers unless you place the app behind stronger auth or edge filtering
- Deleting an attachment from the UI removes the reference from state, but does not yet delete the blob object

## Dependency Risks
Current `npm audit` still reports unresolved or upgrade-sensitive issues in:
- `next`
- `jspdf`
- `xlsx`
- transitive PWA dependencies

The `xlsx` advisory currently has no direct fix in the installed package line, so treat Excel import as a residual risk until that library is replaced or removed.

## Deployment Checklist
- [ ] Rotate any real credentials that were ever stored in local context files
- [ ] Confirm `.ai-context.md` is ignored and not staged
- [ ] Set all Vercel environment variables
- [ ] Set `NEXT_PUBLIC_DATA_MODE=remote`
- [ ] Verify Azure PostgreSQL firewall/network access allows Vercel
- [ ] Verify Azure Blob connection string and container name
- [ ] Test upload, preview, download, and remote state sync on the live site
- [ ] Add real authentication before production use by external users
