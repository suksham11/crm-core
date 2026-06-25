# API Documentation

**Base URL:** `/api/v1`

**Auth:** All endpoints except `/auth/login` and `/auth/register` require `Authorization: Bearer <token>` header.

---

## Authentication

### POST /auth/login

Authenticate and receive a JWT token.

**Request:**
```json
{
  "email": "admin@crm.local",
  "password": "securepassword"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

### POST /auth/register

Register a new user (public, but typically admin-only via route guard).

**Request:**
```json
{
  "email": "rep@crm.local",
  "password": "securepassword",
  "full_name": "Sales Rep",
  "role": "sales_rep"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "email": "rep@crm.local",
  "full_name": "Sales Rep",
  "role": "sales_rep",
  "is_active": true,
  "created_at": "2026-06-25T00:00:00Z",
  "updated_at": "2026-06-25T00:00:00Z"
}
```

### GET /auth/me

Get current authenticated user.

**Response (200):**
```json
{
  "id": "uuid",
  "email": "admin@crm.local",
  "full_name": "Admin User",
  "role": "admin",
  "is_active": true,
  "created_at": "2026-06-25T00:00:00Z",
  "updated_at": "2026-06-25T00:00:00Z"
}
```

---

## Leads

### POST /leads

Create a new lead. Email and phone are normalized automatically.

**Request:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": " JOHN@EXAMPLE.COM ",
  "phone": "  (555) 123-4567 ",
  "company": "Acme Inc",
  "source": "website",
  "notes": "Interested in premium plan"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+15551234567",
  "company": "Acme Inc",
  "status": "new",
  "source": "website",
  "notes": "Interested in premium plan",
  "is_active": true,
  "created_at": "2026-06-25T00:00:00Z",
  "updated_at": "2026-06-25T00:00:00Z"
}
```

**Notes:**
- Duplicate detection: if same `(email, phone)` exists, fields are updated (upsert).
- A Celery task is enqueued for 24-hour follow-up.

### GET /leads

List leads with pagination, search, and status filtering.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | int | 1 | Page number |
| page_size | int | 50 | Items per page (max 200) |
| search | string | — | Search across name, email, phone |
| status | enum | — | Filter by status |
| sort_by | string | created_at | Sort column |
| sort_order | string | desc | asc or desc |

**Response (200):**
```json
{
  "items": [
    {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "phone": "+15551234567",
      "company": "Acme Inc",
      "status": "new",
      "source": "website",
      "notes": null,
      "is_active": true,
      "created_at": "2026-06-25T00:00:00Z",
      "updated_at": "2026-06-25T00:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 50,
  "total_pages": 1
}
```

### GET /leads/{lead_id}

Get a single lead by ID.

**Response (200):** Single lead object (same shape as above).

**Error (404):** `{"detail": "Lead not found"}`

### PATCH /leads/{lead_id}

Update a lead's fields. Send only the fields to update.

**Request:**
```json
{
  "status": "contacted",
  "notes": "Called and left voicemail"
}
```

**Response (200):** Updated lead object.

### DELETE /leads/{lead_id}

**Roles required:** `admin`, `manager`

Hard-delete a lead. No response body (204).

### POST /leads/bulk-status

**Roles required:** `admin`, `manager`

Bulk update lead statuses.

**Request:**
```json
{
  "lead_ids": ["uuid1", "uuid2"],
  "status": "qualified"
}
```

**Response (200):** Array of updated lead objects.

### POST /leads/bulk-ingest

**Roles required:** `admin`, `manager`

Upload a CSV file to bulk import leads. CSV must have headers: `first_name, last_name, email, phone, company, source, notes`.

**Request:** `multipart/form-data` with `file` field.

**Response (201):**
```json
{
  "ingested": 5000,
  "filename": "leads.csv"
}
```

---

## Users (Admin Only)

### GET /users

**Roles required:** `admin`

List all users.

**Response (200):** Array of user objects.

### GET /users/{user_id}

**Roles required:** `admin`

Get a single user.

### PATCH /users/{user_id}

**Roles required:** `admin`

Update a user (e.g., change role, deactivate).

**Request:**
```json
{
  "role": "manager",
  "is_active": true
}
```

### DELETE /users/{user_id}

**Roles required:** `admin`

Delete a user (204).

---

## Error Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (delete success) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient role) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 422 | Validation Error |

---

## Rate Limiting

Not yet implemented. Recommended to add via slowapi or nginx rate limiting.

---

## Webhook Payload Format

Since the external webhook system is not specified, the `POST /leads` endpoint serves as the webhook ingress point. Expected payload format:

```json
{
  "first_name": "string (required)",
  "last_name": "string (required)",
  "email": "string (required, will be normalized)",
  "phone": "string (required, will be normalized)",
  "company": "string (optional)",
  "source": "string (optional)",
  "notes": "string (optional)"
}
```
