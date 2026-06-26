import csv
import io
from typing import Generator

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import func

from app.models.lead import Lead
from app.schemas.lead import LeadCreate


def _row_to_lead(row: dict) -> LeadCreate:
    return LeadCreate(
        first_name=row.get("first_name", "").strip(),
        last_name=row.get("last_name", "").strip(),
        email=row.get("email", "").strip().lower(),
        phone=row.get("phone", "").strip(),
        company=row.get("company", "").strip() or None,
        source=row.get("source", "").strip() or None,
        notes=row.get("notes", "").strip() or None,
    )


def parse_csv(content: str) -> list[LeadCreate]:
    reader = csv.DictReader(io.StringIO(content))
    return [_row_to_lead(row) for row in reader]


def bulk_insert_leads(db: Session, leads: list[LeadCreate], batch_size: int = 500) -> int:
    inserted = 0
    for i in range(0, len(leads), batch_size):
        batch = leads[i : i + batch_size]
        rows = []
        for l in batch:
            rows.append({
                "first_name": l.first_name,
                "last_name": l.last_name,
                "email": l.email,
                "phone": l.phone,
                "company": l.company,
                "source": l.source,
                "notes": l.notes,
            })
        stmt = insert(Lead).values(rows)
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["email", "phone"],
            index_where=Lead.is_active == True,
        )
        result = db.execute(stmt)
        db.commit()
        inserted += result.rowcount
    return inserted
