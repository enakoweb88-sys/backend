# ENAKO Cloud System - Backend

## Uploaded work reports

Work reports accept up to five files of any type, at most 20 MB each. The backend saves
the original bytes, filenames, sizes and SHA-256 checksums in `report_documents` in the
same database transaction as the report. Reports and inbox responses fetch metadata only.
Document downloads require authentication and report access; drafts remain author-only.
PDF, common image formats and UTF-8 text have browser previews. Other formats download
as the original file, without conversion or public sharing links.

Deploy the updated Prisma schema before starting this backend (`prisma db push` is
already part of `start:prod`). On startup the backend enables row-level security and
revokes public Data API access to `report_documents`. The database connection must own
this table so it can apply those protections. No public upload directory or Storage
bucket is used for these report attachments.

Checks: `node --test scripts/test-report-documents.cjs scripts/test-reports.cjs`.
`node scripts/test-report-storage-db.cjs` verifies binary integrity and the security SQL
against the configured database using a session-local temporary table only.

Backend server for the ENAKO Cloud System built with Express and TypeScript.

## Setup

### Prerequisites
- Node.js >= 18.0.0
- npm or yarn

### Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file from the template:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env` as needed.

## Development

Start the development server with hot reload:
```bash
npm run dev
```

The server will be available at `http://localhost:5000`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run the compiled JavaScript
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Project Structure

```
src/
├── index.ts          # Application entry point
├── controllers/      # Request handlers
├── routes/          # Route definitions
├── middleware/      # Custom middleware
└── utils/           # Utility functions
dist/               # Compiled output (generated)
```

## API Documentation

### Health Check
- `GET /health` - Returns server status

### API Routes
- Base URL: `/api/v1/`
- Routes to be implemented

## Environment Variables

See `.env.example` for available configuration options.

## License

Proprietary

<!-- Trigger Render deployment -->
