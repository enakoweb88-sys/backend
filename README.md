# ENAKO Cloud System - Backend

## Uploaded work reports

Employee submissions notify managers first. The CEO cannot list, open or download
employee reports until a manager accepts them. Acceptance records the manager's review
and notifies the CEO in the same transaction. Returned reports stay with the author
and management until corrected and accepted. Managers' own reports go directly to the
CEO because reports cannot be self-approved.

Each report submission, acceptance, correction request and resubmission writes an
in-system notification and an email-delivery job in the same transaction. A worker
checks every 10 seconds, records delivery results, and retries temporary failures
with backoff. Expired leases recover after restarts, and conditional claims prevent
multiple server instances from delivering the same pending job concurrently.
Report emails are operational notices; they are queued for every report recipient.

The CEO's `personalEmail` contact is used for notification delivery without changing
the login `email` or password. Existing mail callers targeting a CEO login address
are redirected centrally to that contact. Set `OS_APP_URL` to the OS frontend origin
so notification links open the correct report. Configure Resend or SMTP credentials
in the deployment environment. Email jobs and report documents require the updated
Prisma schema; startup revokes public API access to the delivery queue as well.

Work reports accept up to five files of any type, at most 20 MB each. The backend saves
the original bytes, filenames, sizes and SHA-256 checksums in `report_documents` in the
same database transaction as the report. Reports and inbox responses fetch metadata only.
Document downloads require authentication and report access; drafts remain author-only.
PDF, common image formats and UTF-8 text have browser previews. Other formats download
as the original file, without conversion or public sharing links.

Application startup now verifies the explicitly listed schema upgrades in
`src/modules/prisma/runtime-schema.ts` before Nest initializes storage/security hooks.
This covers Docker, `npm start` and direct `node dist/main.js` launches. The upgrades
preserve existing records and protect new tables within the same transaction. They
are safe to run repeatedly and serialize concurrent instance startup. `start:prod`
uses `start.sh` and no longer runs a general `db push --accept-data-loss`.

The database connection must own these tables so it can apply access protections.
No public upload directory or Storage bucket is used for report attachments.

Checks: `node --test scripts/test-report-documents.cjs scripts/test-reports.cjs`.
`node scripts/test-report-storage-db.cjs` verifies binary integrity and the security SQL
against the configured database using a session-local temporary table only.
`node scripts/test-runtime-schema-db.cjs` tests startup upgrades against an isolated
schema that is removed afterwards, including real Prisma document/email-job inserts,
data preservation and repeat execution. `node scripts/repair-runtime-schema.cjs` can
apply the same explicit upgrades manually during incident recovery.

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
