# PRAAN Activity Management System (PAMS)

Next.js 14 + Bootstrap 5 frontend for PRAAN AMS, prepared for Vercel deployment with Azure PostgreSQL state persistence and Azure Blob file storage.

## Stack
- Framework: Next.js 14 (App Router) + TypeScript
- UI: Bootstrap 5 + Bootstrap Icons + custom CSS
- Charts/Calendar: Chart.js, react-chartjs-2, FullCalendar
- Database: Azure Database for PostgreSQL
- File Storage: Azure Blob Storage
- Deployment: Vercel

## Local Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local`:
```env
DATABASE_URL=postgresql://user:password@host:5432/pams?sslmode=require
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=youraccount;AccountKey=yourkey;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER=activities
NEXT_PUBLIC_FILE_BASE_URL=https://youraccount.blob.core.windows.net/activities
APP_BASE_URL=http://localhost:3000
API_WRITE_TOKEN=your-strong-random-token
NEXT_PUBLIC_DATA_MODE=local
DATABASE_POOL_MAX=5
```

3. Run the app:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables
- `DATABASE_URL`: Azure PostgreSQL connection string
- `AZURE_STORAGE_CONNECTION_STRING`: Azure Blob Storage connection string
- `AZURE_STORAGE_CONTAINER`: Blob container name, defaults to `activities`
- `NEXT_PUBLIC_FILE_BASE_URL`: Optional public file base URL used by Excel exports to convert old `/api/file?id=...` links into direct file links
- `APP_BASE_URL`: Primary site URL, used to validate browser write requests in production
- `API_WRITE_TOKEN`: Optional bearer token for scripted/server-to-server writes
- `NEXT_PUBLIC_DATA_MODE`: Use `remote` to enable PostgreSQL sync from the browser, otherwise `local`
- `DATABASE_POOL_MAX`: Optional PG pool size override

## Remote Data Mode
- `NEXT_PUBLIC_DATA_MODE=local`: all data stays in browser localStorage
- `NEXT_PUBLIC_DATA_MODE=remote`: browser state syncs to `/api/state`, which persists JSON into Azure PostgreSQL

The app auto-creates the `app_state` table on first successful database connection.

## File Uploads
- Uploads go to Azure Blob Storage through `/api/upload`
- Files are served back through `/api/file?id=...`
- Blob container can remain private because downloads are proxied through the app

## Vercel Deployment

Set these environment variables in Vercel:
- `DATABASE_URL`
- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_STORAGE_CONTAINER`
- `APP_BASE_URL`
- `API_WRITE_TOKEN`
- `NEXT_PUBLIC_DATA_MODE`
- `DATABASE_POOL_MAX` (optional)

Recommended values for production:
- `APP_BASE_URL=https://your-production-domain`
- `NEXT_PUBLIC_DATA_MODE=remote`

## Demo Login
- Username: `admin`
- Username: `fatema`
- Username: `rahim`
- Password: `123456`

Current authentication is demo-only and client-side. Production auth still needs a real server-side identity provider.

## Legacy Folders
- `cloudflare/` and `functions/` are legacy deployment artifacts and are not used by the Vercel runtime
- `supabase/` and `supabase.sql` are legacy setup remnants and can be archived later if no longer needed

## Production Notes
- `.ai-context.md` contains local AI context and must never be pushed
- PWA build artifacts (`public/sw.js`, `public/workbox-*.js`) are generated at build time and are git-ignored
- `next/image` is configured as unoptimized to reduce production image optimizer exposure on Vercel
