# Engineering Edge Cases & Deep-Dives

## 1. Idempotency Guarding

**Problem:** A third-party webhook fires twice for the same lead due to aggressive network retry.

**Solution:** Two-layer defense:

- **Application Layer (Normalization):** Before any database operation, the ingress payload's `email` and `phone` fields are normalized (lowercased, digit-stripped). This ensures that `"John@Example.COM"` and `"john@example.com"` produce the same lookup key.

- **Database Layer (Unique Constraint):** A composite `UNIQUE(email, phone)` constraint on the `leads` table is the authoritative guard. The insert uses PostgreSQL's `ON CONFLICT (email, phone) DO UPDATE` (upsert). If a concurrent transaction commits the same normalized pair first, the second transaction hits the conflict and either updates the existing row or is a no-op.

- **Idempotency Key (Optional Enhancement):** For external webhooks that provide an `idempotency-key` header, we can store the key hash in a separate `idempotency_keys` table (TTL-based). Before processing, we check this table. This prevents duplicate processing even before the DB constraint check.

**Why this works under concurrent requests:** The unique constraint is enforced at the transaction isolation level. Even if two requests arrive simultaneously, PostgreSQL's MVCC ensures that only one transaction commits the new row; the other either updates it (upsert) or receives a unique violation, which we catch and treat as an update.

---

## 2. Race Condition Resolution

**Problem:** Two concurrent API requests arrive at the same millisecond to update the pipeline status of the same lead.

**Solution:** We use PostgreSQL's row-level locking via `SELECT ... FOR UPDATE`:

```
PATCH /leads/{id}  (Request A)           PATCH /leads/{id}  (Request B)
       │                                         │
       ▼                                         ▼
  BEGIN TX                                   BEGIN TX
       │                                         │
       ▼                                         ▼
  SELECT * FROM leads WHERE id = X           SELECT * FROM leads WHERE id = X
  FOR UPDATE                                 FOR UPDATE (BLOCKS)
       │                                         │
       ▼                                         │
  (reads status="new")                           │  (waits for A to commit)
       │                                         │
       ▼                                         │
  UPDATE leads SET status="contacted"            │
  WHERE id = X                                   │
       │                                         │
       ▼                                         │
  COMMIT TX ─────────────────────────────────────►
                                                 │
                                                 ▼
                                            (reads status="contacted")
                                                 │
                                                 ▼
                                            UPDATE leads SET status="qualified"
                                            WHERE id = X
                                                 │
                                                 ▼
                                            COMMIT TX
```

**Result:** Request B sees the committed state of Request A. No lost updates. The second status change is valid (`new → contacted → qualified`).

**Application-level alternative:** Use optimistic locking with a `version` column (integer). Each update includes `WHERE version = X`. If the version doesn't match, the update affects 0 rows, and we retry. This avoids long-held locks but requires retry logic.

**Chosen approach:** `SELECT ... FOR UPDATE` for single-resource mutations. Optimistic locking is better for high-contention scenarios but adds complexity.

---

## 3. Structural Multi-Tenancy

**Problem:** A sales rep from Org A must not query records belonging to Org B.

**Solution:** Row-level tenant isolation via an `organization_id` column on every tenant-scoped table.

### Schema Design

```sql
ALTER TABLE leads ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id);
CREATE INDEX idx_leads_org ON leads(organization_id);

ALTER TABLE users ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id);
-- similarly for deals, tasks, audit_logs
```

### Enforcement Layers

1. **Middleware (API Gateway):** Extract `organization_id` from the JWT token claims (issued at login). Inject into request context.

2. **Repository Layer (SQLAlchemy):** Every query automatically filters by `organization_id`:

```python
class TenantBaseQuery:
    def __init__(self, model, db, org_id):
        self.model = model
        self.db = db
        self.org_id = org_id

    def list(self):
        return self.db.query(self.model).filter(
            self.model.organization_id == self.org_id
        ).all()
```

3. **Database Layer (PostgreSQL Row-Level Security):** Enable RLS on tenant tables:

```sql
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leads
    USING (organization_id = current_setting('app.current_org_id')::UUID);
```

4. **API Route Layer:** Depends on the `get_current_org` dependency that reads from the JWT:

```python
def get_current_org(current_user: User = Depends(get_current_user)) -> str:
    return current_user.organization_id
```

**Why this is robust:** Defense-in-depth. Even if the application layer has a bug, RLS at the database level prevents cross-tenant data leakage. The JWT is tamper-proof (signed), so the org claim cannot be forged.

---

## 4. Orphaned Queue Processing

**Problem:** A follow-up task is scheduled, but the parent lead is hard-deleted before execution.

**Solution:** The Celery task verifies lead existence at execution time and handles absence gracefully.

### Sequence

```
1. Lead created → schedule_follow_up.delay(lead_id) enqueued with 24h countdown
2. Before 24h: DELETE /leads/{id} called → lead hard-deleted from DB
3. 24h later: Celery worker picks up the task
4. Task queries: db.query(Lead).filter(Lead.id == lead_id).first()
5. Result: lead is None (deleted)
6. Task marks itself as "cancelled" with reason "lead deleted"
7. No notification dispatched
8. Task completes successfully (no error/retry)
```

### Code Pattern

```python
@shared_task(bind=True, max_retries=3)
def execute_follow_up(self, lead_id: str):
    db = SessionLocal()
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead or not lead.is_active:
            # Parent lead is gone — cancel gracefully
            cancel_related_tasks(db, lead_id)
            return {"status": "cancelled", "reason": "lead_deleted"}

        # ... proceed with notification ...
    finally:
        db.close()
```

### Additional Safeguards

- **Soft-delete preferred:** Instead of hard delete, set `is_active=False`. Tasks check this flag.
- **Task status tracking:** If lead is deleted, related pending tasks are set to `cancelled` in the same transaction.
- **Dead-letter queue:** If a task consistently fails for unexpected reasons, move it to a dead-letter queue for manual inspection.

---

## 5. Bulk IO Serialization

**Problem:** Executing 5,000 separate sequential `INSERT` statements for a CSV ingestion is extremely slow.

**Performance Analysis (5,000 sequential INSERTs):**

| Factor | Impact |
|--------|--------|
| Network round-trips | 5,000 × 1ms = 5s (local) to 5,000 × 10ms = 50s (remote) |
| Transaction overhead | Each INSERT is its own transaction unless wrapped |
| SQL parsing overhead | Each statement parsed separately |
| Index maintenance | Index updated 5,000 times instead of batched |

**Measured estimate:** ~50-100 INSERTs/second sequential → 5,000 records = **50-100 seconds**.

### Bulk-Writing Strategy

**1. Batch INSERT with `executemany()` or bulk insert:**

```python
from sqlalchemy.dialects.postgresql import insert

batch_size = 500
for i in range(0, len(records), batch_size):
    batch = records[i:i + batch_size]
    stmt = insert(Lead).values(batch)
    stmt = stmt.on_conflict_do_nothing()  # dedup during bulk
    db.execute(stmt)
    db.commit()
```

**2. COPY FROM (fastest):**

```python
import io
import csv

buffer = io.StringIO()
writer = csv.writer(buffer)
writer.writerows(rows)
buffer.seek(0)

cursor = db.connection().connection.cursor()
cursor.copy_expert(
    "COPY leads (first_name, last_name, email, phone, ...) FROM STDIN WITH CSV",
    buffer,
)
db.commit()
```

**Performance comparison (5,000 records):**

| Method | Time |
|--------|------|
| Sequential INSERT (5,000) | ~50-100s |
| Batch INSERT (500/batch) | ~1-3s |
| COPY FROM | ~0.2-0.5s |

**Chosen approach:** Batch INSERT (500/batch) balances performance and code clarity. For production-scale migrations (>100k rows), use `COPY FROM`.

**Additional optimizations:**
- Disable triggers/indexes during bulk load, re-enable after
- Use `UNLOGGED` table for staging, then `INSERT ... SELECT` into main table
- Run ingestion inside a single transaction for atomicity
