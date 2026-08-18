# SOP Compass

> Document compliance, simplified.

SOP Compass is a full-stack web application that lets users upload their internal documents and compare them against official Standard Operating Procedure (SOP) documents managed by an admin. Claude AI identifies gaps, flags non-compliant sections, and generates actionable recommendations.

![Screenshot placeholder — replace with actual screenshot]

---

## Prerequisites

- Node.js 18 or later (tested on Node 24)
- npm 9+
- An [Anthropic API key](https://console.anthropic.com/)

---

## Setup

```bash
# 1. Clone / copy the project
cd SOPComplianceCheck

# 2. Install all dependencies (monorepo root install)
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and set your ANTHROPIC_API_KEY and JWT_SECRET

# 4. Seed the database (creates default accounts)
npm run seed

# 5. Start development servers
npm run dev
```

The app will be available at:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3080

---

## Default Credentials

| Role  | Email                    | Password   |
|-------|--------------------------|------------|
| Admin | admin@sopcompass.com     | Admin@1234 |
| User  | user@sopcompass.com      | User@1234  |

---

## Usage Guide

### Admin Flow

1. Log in as `admin@sopcompass.com`
2. Navigate to **SOP Library** (`/admin`)
3. Upload official SOP documents (PDF, DOCX, or PPTX) with title, category, and version
4. Manage SOPs — preview extracted text, edit metadata, or deactivate

### User Flow

1. Log in as `user@sopcompass.com`
2. Go to **Dashboard** (`/dashboard`)
3. **Step 1:** Select an SOP from the card grid
4. **Step 2:** Upload your document (PDF, DOCX, or PPTX)
5. **Step 3:** Click **Analyze Document** — the AI comparison runs asynchronously
6. Once complete, you're redirected to the **Report** page which shows:
   - A compliance score gauge (0–100)
   - Overall assessment: Compliant / Partially Compliant / Non-Compliant
   - Gaps & Issues (grouped by Critical / Major / Minor)
   - Recommendations (prioritized High / Medium / Low)
   - Compliant Sections (side-by-side comparison)
   - Raw JSON details (admin only)
7. Use the **Export / Print** button to save as PDF

---

## Architecture

```
sop-compass/
├── client/                   React + TypeScript + Vite + Tailwind CSS v4
│   └── src/
│       ├── pages/            LoginPage, AdminDashboard, UserDashboard, ReportPage
│       ├── components/       Reusable UI components
│       ├── hooks/            useAuth (JWT context)
│       └── api/              Typed fetch wrapper
├── server/                   Node.js + Express + TypeScript
│   └── src/
│       ├── routes/           auth, sops, compare
│       ├── services/         db (SQLite), documentParser, aiComparator
│       └── middleware/       JWT authentication
├── data/
│   ├── uploads/              Admin SOP files
│   ├── submissions/          User submitted documents
│   └── sop-compass.db        SQLite database (auto-created)
└── .env                      Environment variables
```

**Key design decisions:**
- AI comparison is **async**: the API returns a `reportId` immediately; the frontend polls `/compare/status/:id` every 3 seconds
- Documents are stored on the **local filesystem** under `data/`; extracted text is cached in SQLite
- Filenames on disk are UUID-based for safety; original names are stored in the database for display
- The Vite dev server proxies `/api` to the backend, so no CORS configuration is needed during development

---

## Environment Variables

| Variable           | Description                            | Default       |
|--------------------|----------------------------------------|---------------|
| `ANTHROPIC_API_KEY`| Your Anthropic API key                 | *(required)*  |
| `JWT_SECRET`       | Secret key for signing JWT tokens      | *(required)*  |
| `PORT`             | Port the backend listens on            | `3001`        |
| `NODE_ENV`         | `development` or `production`          | `development` |

---

## Changing the AI Model or Prompt

The AI integration lives in [`server/src/services/aiComparator.ts`](server/src/services/aiComparator.ts).

**To change the model**, update the `model` field in the `client.messages.create()` call:

```typescript
const message = await client.messages.create({
  model: 'claude-opus-4-7',   // ← change here
  max_tokens: 4096,
  ...
});
```

**To change the system prompt**, edit the `SYSTEM_PROMPT` constant at the top of the file.

**To change the user prompt structure**, edit the `buildComparisonPrompt` logic inside `compareDocuments()`.

---

## Available Scripts

| Script          | Description                                       |
|-----------------|---------------------------------------------------|
| `npm run dev`   | Start both client (port 5173) and server (3001)   |
| `npm run seed`  | Create default admin and test user in the database|
| `npm run build` | Build both client and server for production       |
