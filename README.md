# CRM Core

A production-ready CRM system with lead intake, deduplication, automated follow-up queues, and role-based access control.

## Tech Stack

| Layer          | Technology                     |
| -------------- | ------------------------------ |
| Frontend       | React 18 + Vite + Tailwind CSS |
| Backend        | FastAPI (Python 3.12)          |
| Database       | PostgreSQL 16                  |
| ORM            | SQLAlchemy 2.0                 |
| Auth           | JWT (python-jose)              |
| Queue          | Celery + Redis                 |
| Virtualization | TanStack Virtual               |

## Architecture Overview

```
Client (React SPA) ──HTTP──> FastAPI ──SQL──> PostgreSQL
                                 │
                                 ├── JWT Auth (Middleware)
                                 │
                                 └── Celery Worker ──> Redis (Broker)
                                        │
                                        └── SendGrid / WhatsApp API
```

## Project Structure

```
crm-core/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Route handlers (leads, auth, users)
│   │   ├── core/            # Security, RBAC
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # Business logic (lead, auth, CSV, notification)
│   │   ├── workers/         # Celery app + tasks
│   │   ├── utils/           # Normalizers, validators
│   │   ├── config.py        # Settings via pydantic-settings
│   │   ├── database.py      # Engine, session, Base
│   │   └── main.py          # FastAPI app entry
│   ├── Dockerfile
│   ├── Dockerfile.celery
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios client + endpoint wrappers
│   │   ├── components/      # VirtualizedTable, LeadDrawer, SearchBar, etc.
│   │   ├── contexts/        # AuthContext
│   │   ├── hooks/           # useDebounce
│   │   ├── pages/           # Login, Dashboard, Leads, Users
│   │   ├── App.tsx          # Router with protected routes
│   │   └── main.tsx         # Entry point
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── docs/
    ├── architecture.md
    ├── er_diagram.md
    └── api.md
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local frontend dev)
- Python 3.12+ (for local backend dev)

### Run with Docker (recommended)

```bash
docker compose up --build
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Frontend: http://localhost:5173

### Run locally

**Backend:**

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload
```

If you want a single demo/admin account to be created automatically on first run, set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in `backend/.env` before starting the API.

**Celery Worker:**

```bash
cd backend
celery -A app.workers.celery_app worker --loglevel=info
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `CELERY_BROKER_URL` | Yes | Redis URL for Celery broker |
| `CELERY_RESULT_BACKEND` | Yes | Redis URL for Celery results |
| `SECRET_KEY` | Yes | Random secret for JWT signing |
| `ENVIRONMENT` | No | `development` or `production` |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `BOOTSTRAP_ADMIN_EMAIL` | No | Auto-create admin on first run |
| `BOOTSTRAP_ADMIN_PASSWORD` | No | Admin password |
| `SENDGRID_API_KEY` | No | SendGrid API key |
| `FROM_EMAIL` | No | Sender email address |
| `WHATSAPP_API_KEY` | No | WhatsApp Cloud API key |
| `WHATSAPP_PHONE_NUMBER_ID` | No | WhatsApp phone number ID |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes (production) | Backend API URL (e.g. `https://your-backend.up.railway.app/api/v1`) |
| `VITE_API_PROXY_TARGET` | No (local dev) | Backend URL for Vite proxy (e.g. `http://localhost:8000`) |

## Deployment

### 1. Database — Neon PostgreSQL

1. Create a free account at [neon.tech](https://neon.tech)
2. Create a project and copy the connection string
3. Format: `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/crm_core?sslmode=require`

### 2. Redis — Upstash

1. Create a free account at [upstash.com](https://upstash.com)
2. Create a Redis database
3. Copy the REST URL for connection

### 3. Backend — Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

**Service 1 — API:**

1. Create a new Railway project
2. Connect your GitHub repository
3. Set root directory to `backend/`
4. Add environment variables from the table above
5. Railway auto-detects the Dockerfile
6. If using Neon, set `DATABASE_URL` with `sslmode=require`
7. If using Upstash, set `REDIS_URL`, `CELERY_BROKER_URL`, and `CELERY_RESULT_BACKEND` to the Upstash Redis connection string

**Service 2 — Celery Worker:**

1. Add another service in the same Railway project
2. Set root directory to `backend/`
3. Override start command:
   ```
   celery -A app.workers.celery_app worker --loglevel=info --concurrency=2
   ```
4. Add the same environment variables

### 4. Frontend — Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Import your GitHub repository
2. Set root directory to `frontend/`
3. Framework preset: **Vite**
4. Set `VITE_API_URL` to your Railway backend URL, for example `https://your-backend.up.railway.app/api/v1`
5. Leave `VITE_API_PROXY_TARGET` unset in production

### 5. Production URLs

- Frontend: `https://<project>.vercel.app`
- Backend: `https://<project>.up.railway.app`
- Health: `https://<project>.up.railway.app/health`
- Docs: `https://<project>.up.railway.app/docs`

### 6. Verification Checklist

- Login: needs valid seeded or registered user
- Dashboard: loads after authentication
- CRUD: backend endpoints remain unchanged
- Redis/Celery: depends on Upstash and Railway worker credentials
- PostgreSQL: depends on Neon `DATABASE_URL`
- Email/WhatsApp: skipped unless SendGrid and WhatsApp credentials are provided

## Local Development (without Docker)

```bash
# Backend
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload

# Celery (separate terminal)
celery -A app.workers.celery_app worker --loglevel=info

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Docker Development

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Frontend Features

### Dashboard
- **KPI Cards** — Real-time summary of lead pipeline: Total, New, Contacted, Qualified, Proposal, Won, Lost
- Stats fetched via parallel API calls (one per status) using existing endpoints
- Loading skeleton state while data loads

### Leads Grid
- **Virtualized Table** — Smooth rendering of 50k+ rows using TanStack Virtual
- **Search-as-you-type** — Debounced (300ms) with AbortController to kill stale queries
- **Status Drawer** — Inline slide-out panel for updating lead status and notes with optimistic UI
- **Pagination** — Server-side paginated with Previous/Next controls
- **Loading States** — Skeleton placeholders during data fetch
- **Empty State** — Context-aware empty state (different message when searching vs no data)

### Lead Management
- **Add Lead Modal** — Form with all required fields; submits to `POST /api/v1/leads`
- **Import CSV Modal** — File picker + progress bar; submits to `POST /api/v1/leads/bulk-ingest`
- Shows import result (record count) on success

### Notifications
- **Toast System** — Slide-in notifications for:
  - Lead created (success)
  - Lead updated (success)
  - Lead import completed (success)
  - Error messages from API (error)
- Auto-dismiss after 4 seconds

### Access Control
- **Protected Routes** — Route-level guards check JWT auth state
- **Role-based rendering** — Admin-only pages (Users) restricted at route level
- Unauthenticated users redirected to `/login`

## Core Features

### 1. Lead Intake API

- `POST /api/v1/leads` — Create lead with automatic phone/email normalization
- `GET /api/v1/leads` — Paginated, searchable, filterable list
- `PATCH /api/v1/leads/{id}` — Update lead status/fields
- `DELETE /api/v1/leads/{id}` — Soft-delete (Manager+)

### 2. Concurrency Dedup

- Unique constraint on `(email, phone)` at DB level
- Application-level normalization before upsert
- Handles concurrent requests safely via unique constraint + ON CONFLICT

### 3. Follow-up Queue

- Celery task scheduled on lead creation (24h delay)
- Graceful handling: if lead is deleted before execution, task cancels itself
- Retry with exponential backoff

### 4. Bulk CSV Ingestion

- `POST /api/v1/leads/bulk-ingest` — Upload CSV
- Batch insert (500 rows/batch) using `INSERT ... ON CONFLICT DO NOTHING`
- Uses pandas-style parsing via csv.DictReader

### 5. Auth & RBAC

- JWT-based authentication
- Three roles: `admin`, `manager`, `sales_rep`
- Route-level enforcement via dependency injection
- Admin: full access; Manager: lead management; Sales Rep: read + own updates

### 6. Integration Middleware

- Async email dispatch via SendGrid
- Async WhatsApp dispatch via Cloud API
- Triggered from follow-up tasks on lead stage transitions

## Data Flow

1. Lead enters via API webhook or CSV upload
2. Email/phone normalized; duplicate check via unique constraint
3. Lead stored; Celery task enqueued for 24h follow-up
4. User views leads in virtualized table (50k+ rows)
5. User updates status via inline drawer with optimistic UI
6. Celery worker executes follow-up, dispatches notification

## Design Trade-offs

- **Sync API vs Event-driven**: Chose REST for simplicity. Events via webhooks can be added later.
- **Celery over BullMQ**: Python stack consistency with FastAPI.
- **Unique constraint over application lock**: Simpler, robust for concurrent writes.
- **Optimistic updates in frontend**: Better UX; rolls back on error.

## Technical Debt & Resolution

| Debt                             | Resolution                                       |
| -------------------------------- | ------------------------------------------------ |
| No database migrations (Alembic) | Run `alembic init` and version control schemas   |
| No multi-tenancy                 | Add `organization_id` column + filter middleware |
| No rate limiting                 | Add slowapi or middleware                        |
| No comprehensive test suite      | Add pytest + vitest                              |
| No CI/CD pipeline                | Add GitHub Actions workflow                      |

## License

Internal use.
