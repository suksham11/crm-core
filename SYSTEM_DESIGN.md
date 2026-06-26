# CRM Core — System Design Document

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Client Layer                                    │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │              React SPA (Vite + Tailwind + TanStack Virtual)        │  │
│  │  - Auth Context (JWT stored in localStorage)                       │  │
│  │  - Optimistic UI (inline status drawer with rollback)              │  │
│  │  - Debounced search (300ms) with AbortController                   │  │
│  └──────────────────────┬─────────────────────────────────────────────┘  │
└─────────────────────────┼─────────────────────────────────────────────────┘
                          │ HTTP/JSON (Axios)
                          │ JWT Bearer Token
                          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       API Layer (FastAPI)                                │
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐   │
│  │  Auth    │  │  Leads   │  │  Users   │  │  Middleware            │   │
│  │  /auth   │  │  /leads  │  │  /users  │  │  CORS, JWT, RBAC      │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────────────────────┘   │
│       │              │              │                                    │
│       └──────────────┼──────────────┘                                    │
│                      │                                                  │
│               ┌──────▼──────┐                                           │
│               │  Services   │                                           │
│               │  lead_svc   │                                           │
│               │  csv_svc    │                                           │
│               │  notify_svc │                                           │
│               └──────┬──────┘                                           │
└──────────────────────┼──────────────────────────────────────────────────┘
                       │
          ┌────────────┼────────────────────┐
          │            │                    │
          ▼            ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌──────────────────────┐
│   PostgreSQL    │ │      Redis      │ │   SendGrid /        │
│   (Primary DB)  │ │  (Celery Broker │ │   WhatsApp Cloud    │
│                 │ │   + Backend)    │ │   (Notifications)   │
└─────────────────┘ └────────┬────────┘ └──────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Celery Worker  │
                    │                 │
                    │ notify_follow_  │
                    │ up_24h          │
                    │                 │
                    │ notify_stage_   │
                    │ change          │
                    └─────────────────┘
```

**Key design decisions:**
- REST API over GraphQL — simpler, cacheable, widely supported
- Synchronous writes with async background jobs — fast API responses (leads are created/updated synchronously, notifications are offloaded to Celery)
- PostgreSQL for structured data, Redis for transient queue state — each optimized for its workload

---

## 2. Database Schema

### Entity Relationship

```
┌─────────────┐    1       * ┌─────────────┐
│    Lead     │──────────────│    Deal     │
│             │              │             │
│ id (PK)     │              │ id (PK)     │
│ email+phone │              │ lead_id(FK) │
│ (UNIQUE)    │              │ name        │
│ first_name  │              │ value       │
│ last_name   │              │ stage       │
│ status      │              └─────────────┘
│ phone       │
│ company     │    1       * ┌─────────────┐
│ source      │──────────────│    Task     │
│ notes       │              │             │
│ is_active   │              │ id (PK)     │
│ created_at  │              │ lead_id(FK) │
│ updated_at  │              │ task_type   │
└─────────────┘              │ status      │
                             │ scheduled_at│
┌─────────────┐              └─────────────┘
│    User     │
│             │    1       * ┌─────────────┐
│ id (PK)     │──────────────│  AuditLog   │
│ email(UNIQ) │              │             │
│ hashed_pass │              │ id (PK)     │
│ full_name   │              │ user_id(FK) │
│ role        │              │ entity_type │
│ is_active   │              │ action      │
│ created_at  │              │ changes     │
│ updated_at  │              │ created_at  │
└─────────────┘              └─────────────┘
```

### Indexes

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| `leads` | `(email, phone)` | UNIQUE | Deduplication |
| `leads` | `email` | B-tree | Search/lookup |
| `leads` | `phone` | B-tree | Search/lookup |
| `leads` | `created_at` | B-tree | Pagination sorting |
| `users` | `email` | UNIQUE | Login lookup |
| `audit_logs` | `created_at` | B-tree | Audit trail queries |
| `audit_logs` | `(entity_type, entity_id)` | B-tree | Entity lookup |

---

## 3. API Architecture

### Design Principles

- **RESTful** — Resources map to URL paths, HTTP methods map to operations
- **Stateless** — No server-side sessions; JWT contains all auth state
- **Versioned** — All routes under `/api/v1/`
- **Consistent error shape** — All errors return `{ "detail": "..." }`

### Request Lifecycle

```
HTTP Request
    │
    ▼
CORS Middleware (allow origins, headers, methods)
    │
    ▼
FastAPI Router (match path + method)
    │
    ▼
Dependencies:
  ├── get_db() → SQLAlchemy session (per-request, auto-closed)
  └── get_current_user() → decode JWT → fetch User
      └── require_role("admin", "manager") → check role
    │
    ▼
Route Handler → Service Layer → Database
    │
    ▼
Pydantic Response (validation + serialization)
    │
    ▼
HTTP Response
```

### Rate Limiting

Not implemented. Recommended: slowapi middleware with per-user rate limits based on JWT claims, or nginx `limit_req` at the reverse proxy level.

---

## 4. Redis and Celery Queue Design

### Architecture

```
FastAPI ──> Redis (broker) ──> Celery Worker ──> Redis (backend)
                │                                      │
          tasks queue                              task results
          (list/stream)                          (key-value)
```

### Task Definitions

| Task | Trigger | Queue | Retries | Timeout | Description |
|------|---------|-------|---------|---------|-------------|
| `notify_follow_up_24h` | Lead creation | `celery` (default) | 3 (60s delay) | 30 min | Runs 24h after creation; checks if lead still "New" |
| `notify_stage_change` | Status update | `celery` (default) | 3 (60s delay) | 30 min | Sends notification on stage transition |

### Configuration

```python
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,      # 30 minutes hard limit
    task_soft_time_limit=25 * 60,  # 25 minutes soft limit
    worker_prefetch_multiplier=1,  # One task at a time per worker
)
```

### Reliability Mechanisms

- **acks_late=True** on `notify_follow_up_24h` — task re-delivers if worker crashes mid-execution
- **max_retries=3** with `default_retry_delay=60` — exponential backoff on failure
- **Result backend** — task status and return values stored in Redis for inspection
- **Graceful handling** — if lead is deleted, task exits cleanly without error

### Scaling Considerations

- Add dedicated queues per task type: `celery -A app.workers.celery_app worker -Q followups,notifications`
- Increase `--concurrency` for higher throughput
- Use priority queues for time-sensitive notifications over follow-ups

---

## 5. Authentication & RBAC

### JWT Token Structure

```json
{
  "sub": "user-uuid",
  "role": "admin",
  "exp": 1719334800
}
```

- Signed with HS256 using `SECRET_KEY`
- Default expiry: 30 minutes (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`)
- No refresh tokens implemented (token re-issue requires re-login)

### Auth Flow

```
1. POST /auth/login → verify email+password → return JWT
2. Client stores JWT in localStorage
3. Every request includes `Authorization: Bearer <token>`
4. FastAPI dependency extracts + decodes JWT → `get_current_user()`
5. Role check via `require_role("admin", "manager")`
```

### Role Hierarchy

| Role | Permissions |
|------|-------------|
| `admin` | Full access: leads CRUD, user management, bulk operations |
| `manager` | Lead management: CRUD, bulk operations, CSV ingest |
| `sales_rep` | Read + create leads, update owned leads, no delete |

RBAC is enforced at the dependency injection layer — routes declare required roles via `require_role("admin", "manager")`, and FastAPI validates against the decoded JWT role claim.

---

## 6. Scalability Strategy

### Horizontal Scaling

| Component | Strategy |
|-----------|----------|
| FastAPI | Multiple workers behind nginx/load balancer; stateless so any instance can serve any request |
| Celery Worker | Multiple concurrent workers (`--concurrency=4`); add worker processes per queue |
| PostgreSQL | Connection pooling (PgBouncer), read replicas for query offloading, composite indexes |
| Redis | Standard single-node; Redis Cluster for high availability |
| React SPA | Static files served via CDN (Vercel, Cloudflare) |

### Database Optimization (5 → 50+ agents)

- Add PgBouncer for connection pooling
- Add read replicas for dashboard queries (lead counts, stats)
- Partition `audit_logs` by month for write-heavy audit trails
- Add composite indexes for common query patterns
- Consider Redis caching for lead status counts (invalidated on write)

---

## 7. Fault Tolerance

### Failure Scenarios

| Failure | Behavior |
|---------|----------|
| Redis/Celery unavailable | API catches exception, logs warning (dev) or error (prod), returns 201 without scheduling |
| PostgreSQL down | API returns 500; connection pool (`pool_pre_ping=True`) detects stale connections |
| SendGrid/WhatsApp API down | `_send_notification` logs error, returns `False`; task completes without retry |
| Celery worker crash (mid-task) | `acks_late=True` re-delivers unacknowledged tasks to another worker |
| Task execution error | `max_retries=3` with 60s delay; after exhausted, task remains in failed state in result backend |

### Data Integrity

- Unique constraint on `(email, phone)` at database level prevents duplicate leads
- `ON CONFLICT DO NOTHING` for bulk CSV inserts — no partial failures
- Audit logs track all mutations with user ID, action, and timestamp
- PostgreSQL MVCC handles concurrent transactions safely

---

## 8. CI/CD Approach

### Pipeline Blueprint

```
Push to main → GitHub Actions
    │
    ├── Lint (ruff / eslint)
    ├── Type Check (mypy / tsc)
    ├── Test (pytest / vitest)
    ├── Build Docker images
    │
    ├── Deploy to Staging (Render + Vercel)
    │   └── Integration tests
    │
    └── Deploy to Production (blue/green)
        └── Smoke tests
```

### Current State

- No CI/CD pipeline is configured (identified as technical debt)
- Railway config exists for backend; Vercel config for frontend
- Docker Compose for local/staging single-server deployments
- Environment variables injected via deployment platform dashboards

---

## 9. Deployment Architecture

### Production Topology

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Vercel    │     │   Render    │     │    Neon     │
│  (Frontend) │────▶│  (Backend)  │────▶│ (PostgreSQL)│
│             │     │             │     │             │
│ React SPA   │     │ FastAPI     │     │ Managed DB  │
│ served via  │     │ + Celery    │     │ Automatic   │
│ CDN         │     │ Worker      │     │ backups     │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │   Upstash   │
                    │   (Redis)   │
                    │             │
                    │ Managed     │
                    │ Redis 7     │
                    └─────────────┘
```

### Docker Compose (Local/Dev)

```
docker-compose.yml
  ├── db: postgres:16-alpine
  ├── redis: redis:7-alpine
  ├── api: FastAPI (--reload for dev)
  ├── celery_worker: Celery worker
  └── frontend: React dev server with proxy
```

---

## 10. Trade-offs

| Decision | Rationale | Alternative Considered |
|----------|-----------|----------------------|
| REST API | Simple, cacheable, universally supported | GraphQL (overkill for current scope) |
| Celery over BullMQ | Python stack consistency with FastAPI | BullMQ (better if Node.js stack) |
| PostgreSQL unique constraint over app-level lock | Simpler, robust for concurrent writes, no lock management | Application-level distributed lock (Redis Redlock) |
| Hard-delete leads | Simpler; orphaned tasks handle gracefully | Soft-delete (requires `is_active` checks everywhere) |
| Synchronous CSV ingest | Simple for <10k rows | Async Celery task (needed for >10k rows) |
| Single Celery queue | Simple setup | Multiple queues per task type (better isolation) |
| No rate limiting | Not in scope | slowapi middleware (easy to add) |
| JWT in localStorage | Simple implementation | HTTP-only cookies (more secure against XSS) |
| Optimistic UI (frontend) | Better UX, instant feedback | Pessimistic UI (simpler but slower) |
| No Alembic migrations | Faster initial development | Version-controlled migrations (required for production) |
