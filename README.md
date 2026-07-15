# ENAKO Cloud System - Backend

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
