# Architecture Document

## High-Level Infrastructure Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client Layer                                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │          React SPA (Vite + Tailwind)                          │  │
│  │  - Virtualized Grid (TanStack Virtual)                        │  │
│  │  - Optimistic UI (TanStack Query)                             │  │
│  │  - Auth Context + Protected Routes                            │  │
│  └──────────────────────┬────────────────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────────────┘
                          │ HTTP (Axios)
                          │ JWT Bearer Token
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API Gateway (FastAPI)                        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  /api/v1/auth     ──  JWT Login / Register / Me               │  │
│  │  /api/v1/leads    ──  CRUD + Bulk Ingest + Search             │  │
│  │  /api/v1/users    ──  Admin-only user management              │  │
│  │                                                               │  │
│  │  Middleware: CORS, JWT Validation, RBAC Dependencies          │  │
│  └──────────┬────────────────────────────────────────────────────┘  │
└─────────────┼────────────────────────────────────────────────────────┘
              │ SQLAlchemy
              ▼
┌─────────────────────────────┐    ┌─────────────────────────────┐
│      PostgreSQL 16          │    │      Redis 7                │
│  - Leads, Users, Deals      │    │  - Celery Broker            │
│  - Tasks, Audit Logs        │    │  - Celery Result Backend    │
│  - Unique Constraints       │    └──────────┬──────────────────┘
│  - Indexed columns          │               │
└─────────────────────────────┘               │
                                              │
                                              ▼
                                ┌─────────────────────────────┐
                                │     Celery Worker           │
                                │  - schedule_follow_up       │
                                │  - execute_follow_up        │
                                │  - Email (SendGrid)         │
                                │  - WhatsApp (Cloud API)     │
                                └─────────────────────────────┘
```

## Component Topology

| Component | Scaling Strategy |
|-----------|-----------------|
| FastAPI | Multiple workers behind nginx reverse proxy |
| Celery Worker | Multiple concurrent workers, prefetch=1 |
| PostgreSQL | Connection pool (pool_size=10, max_overflow=20) |
| Redis | Standard single-node; can cluster for HA |
| React SPA | Static file serving via nginx or CDN |

## Data Flow Paths

### Lead Intake Flow
```
Webhook/API → FastAPI → Normalize Email/Phone → Upsert via Unique Constraint
 → Return Lead → Enqueue Celery Task (24h follow-up) → Audit Log
```

### Search Flow
```
User types → Debounce 300ms → AbortController cancels stale requests
 → GET /leads?search=... → PostgreSQL ILIKE → Response → Virtualized Render
```

### Bulk CSV Flow
```
CSV Upload → FastAPI → csv.DictReader → Batch Insert (500/batch)
 → ON CONFLICT DO NOTHING → Return count
```

## Environment Isolation

| Environment | DB | Redis | Config |
|------------|-----|-------|--------|
| Development | Local Docker | Local Docker | .env |
| Staging | Managed PG | Managed Redis | Environment vars |
| Production | RDS/Aurora | ElastiCache | Secrets Manager |

## Scaling (5 → 50+ Agents)

- **Database**: Add connection pooling (PgBouncer), read replicas, composite indices
- **API**: Horizontally scale FastAPI behind load balancer
- **Celery**: Increase concurrency, add dedicated queues per task type
- **Caching**: Add Redis cache for frequent reads (status counts, etc.)
- **Rate Limiting**: Implement per-user rate limits to prevent abuse

## Fault Tolerance

- **Queue Crashes**: Celery retries with backoff, tasks are idempotent
- **DB Pool Exhaustion**: pool_pre_ping, connection timeouts, circuit breaker
- **External API Throttling**: Retry with exponential backoff, dead-letter queue
- **Graceful Degradation**: Read-only mode if DB is degraded, cache fallbacks

## CI/CD Blueprint

```
Push → GitHub Actions → Lint → Test → Build → Deploy Staging
 → Integration Tests → Deploy Production (blue/green)
```

Secrets rotated via environment variables or secrets manager (no hardcoded secrets).
