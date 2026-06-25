import json
import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def send_email(to: str, subject: str, body: str) -> bool:
    if not settings.sendgrid_api_key:
        logger.warning("SENDGRID_API_KEY not configured; skipping email")
        return False
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {settings.sendgrid_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [{"to": [{"email": to}]}],
                    "from": {"email": settings.from_email},
                    "subject": subject,
                    "content": [{"type": "text/plain", "value": body}],
                },
            )
            return resp.is_success
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


async def send_whatsapp(to: str, message: str) -> bool:
    if not settings.whatsapp_api_key or not settings.whatsapp_phone_number_id:
        logger.warning("WhatsApp not configured; skipping message")
        return False
    try:
        url = f"https://graph.facebook.com/v18.0/{settings.whatsapp_phone_number_id}/messages"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {settings.whatsapp_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "messaging_product": "whatsapp",
                    "to": to,
                    "type": "text",
                    "text": {"body": message},
                },
            )
            return resp.is_success
    except Exception as e:
        logger.error(f"Failed to send WhatsApp: {e}")
        return False
