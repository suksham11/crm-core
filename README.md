# CRM Core

A production-ready CRM system with lead intake, deduplication, automated follow-up queues, stage-change notifications, and role-based access control.

## Features

| Feature | Description |
|---------|-------------|
| Lead CRUD | Create, read, update, delete leads with normalized email/phone |
| Deduplication | Composite unique constraint on `(email, phone)` + upsert logic |
| JWT Authentication | Bearer token with configurable expiry |
| Role-Based Access Control | Admin, Manager, Sales Rep roles enforced via dependencies |
| 24h Follow-up | Celery task scheduled at lead creation, checks if still "New" after 24h |
| Stage-Change Notification | Celery task fired on every status transition |
| Email Notifications | Via SendGrid API (falls back gracefully if unconfigured) |
| WhatsApp Notifications | Via WhatsApp Cloud API (falls back gracefully if unconfigured) |
| Bulk CSV Ingestion | Batch insert (500/batch) with `ON CONFLICT DO NOTHING` |
| Bulk Status Update | Update multiple leads' status in one request |
| Pagination & Search | Server-side paginated list with ILIKE search across name/email/phone |
| Audit Logging | Every create, update, delete, and status change is logged |
| Virtualized Table | 50k+ row rendering with TanStack Virtual |
| Optimistic UI | Inline status drawer with rollback on error |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | FastAPI (Python 3.12) |
| Database | PostgreSQL 16 |
| ORM | SQLAlchemy 2.0 |
| Auth | JWT (python-jose + bcrypt) |
| Queue | Celery 5.4 + Redis 7 |
| Notifications | SendGrid (email) + WhatsApp Cloud API |
| Containerization | Docker + Docker Compose |

## Architecture Overview

```
Client (React SPA) ──HTTP──> FastAPI ──SQL──> PostgreSQL
                                 │
                                 ├── JWT Auth (Middleware)
                                 │
                                 ├── Celery Worker ──> Redis (Broker/Backend)
                                 │       │
                                 │       ├── notify_follow_up_24h (24h countdown)
                                 │       └── notify_stage_change (on status update)
                                 │
                                 └── SendGrid / WhatsApp API
```

## Project Structure

```
crm-core/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Route handlers (leads, auth, users)
│   │   ├── core/            # Security, RBAC utilities
│   │   ├── models/          # SQLAlchemy models (Lead, User, Deal, Task, AuditLog)
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # Business logic (lead, CSV, notification)
│   │   ├── workers/         # Celery app + background tasks
│   │   ├── config.py        # Settings via pydantic-settings
│   │   ├── database.py      # Engine, session, Base
│   │   └── main.py          # FastAPI app entry + lifespan
│   ├── Dockerfile
│   ├── Dockerfile.celery
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios client + endpoint wrappers
│   │   ├── components/      # VirtualizedTable, LeadDrawer, SearchBar, etc.
│   │   ├── contexts/        # AuthContext, ToastContext
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
    ├── api.md
    └── deep_dives.md
```

## Setup

### Prerequisites

- Docker & Docker Compose (recommended)
- Node.js 20+ (local frontend dev)
- Python 3.12+ (local backend dev)

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql://crm_user:crm_pass@localhost:5432/crm_core` | PostgreSQL connection string |
| `REDIS_URL` | Yes | `redis://localhost:6379/0` | Redis connection string |
| `CELERY_BROKER_URL` | Yes | `redis://localhost:6379/0` | Redis URL for Celery broker |
| `CELERY_RESULT_BACKEND` | Yes | `redis://localhost:6379/0` | Redis URL for Celery results |
| `SECRET_KEY` | Yes | `change-this-to-a-random-secret-key-in-production` | JWT signing key |
| `ALGORITHM` | No | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `30` | JWT expiry in minutes |
| `ENVIRONMENT` | No | `development` | `development` or `production` |
| `CORS_ORIGINS` | No | `http://localhost:5173,http://localhost:3000` | Comma-separated allowed origins |
| `BOOTSTRAP_ADMIN_EMAIL` | No | — | Auto-create admin user on first run |
| `BOOTSTRAP_ADMIN_PASSWORD` | No | — | Admin password |
| `BOOTSTRAP_ADMIN_FULL_NAME` | No | `CRM Admin` | Admin display name |
| `BOOTSTRAP_ADMIN_ROLE` | No | `admin` | Admin role |
| `SENDGRID_API_KEY` | No | — | SendGrid API key for email |
| `FROM_EMAIL` | No | `noreply@crm-core.local` | Sender email address |
| `WHATSAPP_API_KEY` | No | — | WhatsApp Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | No | — | WhatsApp phone number ID |

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
copy .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload
```

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

## Deployment

### Backend — Render

1. Create a new **Web Service** on Render
2. Connect your GitHub repository
3. Set root directory to `backend/`
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn app.main:app --host 0.0.0.0 --port 10000`
6. Add environment variables from the table above
7. Add a **Cron Job** or **Background Worker** for Celery:
   - Worker command: `celery -A app.workers.celery_app worker --loglevel=info --concurrency=4`

### Frontend — Vercel

1. Import your GitHub repository
2. Set root directory to `frontend/`
3. Framework preset: **Vite**
4. Environment variable: `VITE_API_URL` = your Render backend URL (e.g. `https://crm-core-backend.onrender.com/api/v1`)
5. Leave `VITE_API_PROXY_TARGET` unset in production

### Database — Neon

1. Create a PostgreSQL database on Neon
2. Copy the connection string from Neon dashboard
3. Set as `DATABASE_URL` in Render environment variables

### Redis — Upstash

1. Create a Redis database on Upstash
2. Copy the connection strings
3. Set `REDIS_URL`, `CELERY_BROKER_URL`, and `CELERY_RESULT_BACKEND` in Render

### Docker Compose (single-server deployment)

```bash
docker compose -f docker-compose.yml up --build -d
```

## API Documentation

Interactive docs are available at `/docs` when the API is running.

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/login` | No | Login, returns JWT |
| POST | `/api/v1/auth/register` | No | Register new user |
| GET | `/api/v1/auth/me` | JWT | Get current user |

### Leads

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| POST | `/api/v1/leads` | JWT | All | Create lead (schedules 24h follow-up) |
| GET | `/api/v1/leads` | JWT | All | List with pagination, search, filter |
| GET | `/api/v1/leads/{id}` | JWT | All | Get single lead |
| PATCH | `/api/v1/leads/{id}` | JWT | All | Update lead (triggers stage-change notification) |
| DELETE | `/api/v1/leads/{id}` | JWT | Admin, Manager | Hard-delete lead |
| POST | `/api/v1/leads/bulk-status` | JWT | Admin, Manager | Bulk status update |
| POST | `/api/v1/leads/bulk-ingest` | JWT | Admin, Manager | CSV file upload |

### Users

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/users` | JWT | Admin | List all users |
| GET | `/api/v1/users/{id}` | JWT | Admin | Get single user |
| PATCH | `/api/v1/users/{id}` | JWT | Admin | Update user |
| DELETE | `/api/v1/users/{id}` | JWT | Admin | Delete user |

### Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |

## Background Job Workflow

### 24-Hour Follow-Up

```
1. POST /api/v1/leads → lead created
2. notify_follow_up_24h.apply_async(countdown=86400) enqueued to Redis
3. Celery worker picks up the task after 24h
4. Worker fetches lead from PostgreSQL
   ├── Lead deleted → skip (return "skipped")
   ├── Status != "new" → skip (return "skipped")
   └── Status == "new" → send notification via email/WhatsApp/log
5. Result stored in Redis result backend
```

### Stage-Change Notification

```
1. PATCH /api/v1/leads/{id} with status field
2. Old status captured before update
3. notify_stage_change.delay() enqueued to Redis
4. Celery worker executes immediately
5. Worker fetches lead from PostgreSQL
   ├── Lead deleted → skip (return "skipped")
   └── Lead exists → send notification via email/WhatsApp/log
6. Result stored in Redis result backend
```

## Notification Workflow

```
notify_follow_up_24h / notify_stage_change
         │
         ▼
   _send_notification(lead, subject, body)
         │
         ├── lead.email exists? ──Yes──> send_email() via SendGrid
         │                                   │
         │                                   ├── API key set → send HTTP request
         │                                   └── No key → log warning, return False
         │
         └── lead.phone exists? ──Yes──> send_whatsapp() via WhatsApp Cloud API
                                             │
                                             ├── Credentials set → send HTTP request
                                             └── No creds → log warning, return False
         │
         └── Both failed? → log notification content (no error thrown)
```

Notification is attempted on email first, then WhatsApp. If both fail (or neither is configured), the notification content is logged at `INFO` level — the task never raises an error for missing credentials.

## Assumptions

1. **Single-organization**: The system assumes a single tenant. Multi-tenancy requires adding `organization_id` columns and row-level security.
2. **Synchronous API**: Lead creation and updates are synchronous REST operations. Event-driven architecture (webhooks, event bus) can be added later.
3. **PostgreSQL-specific features**: `ON CONFLICT` upsert and `INSERT ... ON CONFLICT DO NOTHING` are PostgreSQL-specific. Migration to other databases requires changes.
4. **UTC timezone**: All timestamps are stored in UTC. Client-side timezone conversion is the frontend's responsibility.
5. **24-hour fixed window**: Follow-up is scheduled exactly 24 hours after lead creation. Configurable windows require modifying the countdown value.
6. **Celery worker always running**: Background jobs assume the Celery worker process is running. If the worker is down, tasks queue in Redis and execute when the worker starts.

## Known Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No Alembic migrations | Schema changes must be applied manually | Run `alembic init` and version control schemas |
| No rate limiting | API can be overwhelmed | Add slowapi or nginx rate limiting |
| No test suite | Regression risk | Add pytest (backend) + vitest (frontend) |
| No CI/CD pipeline | Manual deployment steps | Add GitHub Actions workflow |
| Hard-delete for leads | Orphaned follow-up tasks must handle missing leads | Tasks check lead existence before processing |
| Single Celery queue | All task types share the same queue | Add dedicated queues per task type for production |
| Synchronous CSV ingest | Large files block the API worker | Process CSV via Celery task for files > 10k rows |
| `--reload` in docker-compose | Development-only flag | Remove for production deployments |
| No email/WhatsApp templates | Plain-text notifications only | Add HTML email templates and rich message formats |

## License

Internal use.
