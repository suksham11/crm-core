# Entity-Relationship Diagram

## Schema Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              LEADS                                         │
├────────────────────────────────────────────────────────────────────────────┤
│ id (UUID PK)                                                               │
│ first_name (VARCHAR 120, NOT NULL)                                         │
│ last_name (VARCHAR 120, NOT NULL)                                          │
│ email (VARCHAR 255, NOT NULL, INDEX)                                       │
│ phone (VARCHAR 30, NOT NULL, INDEX)                                        │
│ company (VARCHAR 255, NULLABLE)                                            │
│ status (ENUM: new|contacted|qualified|proposal|won|lost, NOT NULL)         │
│ source (VARCHAR 100, NULLABLE)                                             │
│ notes (TEXT, NULLABLE)                                                     │
│ is_active (BOOLEAN, DEFAULT TRUE)                                          │
│ created_at (TIMESTAMPTZ, NOT NULL)                                         │
│ updated_at (TIMESTAMPTZ, NOT NULL)                                         │
│ UNIQUE(email, phone)                                                       │
└────────────────────────┬───────────────────────────────────────────────────┘
                         │ 1
                         │
                         │ *
┌────────────────────────┴───────────────────────────────────────────────────┐
│                              DEALS                                         │
├────────────────────────────────────────────────────────────────────────────┤
│ id (UUID PK)                                                               │
│ lead_id (UUID FK → leads.id, ON DELETE CASCADE, NOT NULL)                  │
│ name (VARCHAR 255, NOT NULL)                                               │
│ value (FLOAT, DEFAULT 0.0)                                                 │
│ stage (ENUM: negotiation|closed_won|closed_lost)                           │
│ notes (TEXT, NULLABLE)                                                     │
│ created_at (TIMESTAMPTZ, NOT NULL)                                         │
│ updated_at (TIMESTAMPTZ, NOT NULL)                                         │
└────────────────────────────────────────────────────────────────────────────┘

                         │ 1
                         │
                         │ *
┌────────────────────────┴───────────────────────────────────────────────────┐
│                              TASKS                                         │
├────────────────────────────────────────────────────────────────────────────┤
│ id (UUID PK)                                                               │
│ lead_id (UUID FK → leads.id, ON DELETE SET NULL, NULLABLE)                 │
│ assigned_to (UUID FK → users.id, ON DELETE SET NULL, NULLABLE)             │
│ task_type (ENUM: follow_up|call|email|meeting|other, NOT NULL)             │
│ status (ENUM: pending|completed|cancelled, NOT NULL)                       │
│ title (VARCHAR 255, NOT NULL)                                              │
│ description (TEXT, NULLABLE)                                               │
│ scheduled_at (TIMESTAMPTZ, NULLABLE)                                       │
│ completed_at (TIMESTAMPTZ, NULLABLE)                                       │
│ metadata_json (TEXT, NULLABLE)                                             │
│ created_at (TIMESTAMPTZ, NOT NULL)                                         │
│ updated_at (TIMESTAMPTZ, NOT NULL)                                         │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                              USERS                                         │
├────────────────────────────────────────────────────────────────────────────┤
│ id (UUID PK)                                                               │
│ email (VARCHAR 255, UNIQUE, NOT NULL, INDEX)                               │
│ hashed_password (VARCHAR 255, NOT NULL)                                    │
│ full_name (VARCHAR 255, NOT NULL)                                          │
│ role (ENUM: admin|manager|sales_rep, NOT NULL)                             │
│ is_active (BOOLEAN, DEFAULT TRUE)                                          │
│ created_at (TIMESTAMPTZ, NOT NULL)                                         │
│ updated_at (TIMESTAMPTZ, NOT NULL)                                         │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                           AUDIT_LOGS                                       │
├────────────────────────────────────────────────────────────────────────────┤
│ id (UUID PK)                                                               │
│ user_id (UUID FK → users.id, ON DELETE SET NULL, NULLABLE)                 │
│ entity_type (VARCHAR 50, NOT NULL)                                         │
│ entity_id (VARCHAR 50, NULLABLE)                                           │
│ action (VARCHAR 50, NOT NULL)                                              │
│ changes (TEXT, NULLABLE)                                                   │
│ ip_address (VARCHAR 45, NULLABLE)                                          │
│ created_at (TIMESTAMPTZ, NOT NULL)                                         │
└────────────────────────────────────────────────────────────────────────────┘
```

## Relationship Summary

| Entity 1 | Relation | Entity 2 | Notes |
|----------|----------|----------|-------|
| Lead     | 1 → *    | Deal     | Cascade delete |
| Lead     | 1 → *    | Task     | SET NULL on delete |
| User     | 1 → *    | Task     | assigned_to, SET NULL on delete |
| User     | 1 → *    | AuditLog | SET NULL on delete |

## Indexing Strategy

- `leads.email` — B-tree index for search/lookup
- `leads.phone` — B-tree index for search/lookup
- `leads (email, phone)` — Unique constraint composite index for dedup
- `leads.created_at` — B-tree index for pagination sorting
- `users.email` — Unique index for login
- `audit_logs.created_at` — B-tree index for audit trail queries
- `audit_logs (entity_type, entity_id)` — Composite index for entity lookup
