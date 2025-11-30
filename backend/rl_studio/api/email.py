"""
Email service for sending and receiving emails via Resend API.

Features:
- Send emails (OTP, notifications, etc.)
- Receive emails via webhooks
- Store received emails in Convex
- Webhook signature verification
- Auto-reply functionality
"""

import hashlib
import hmac
import json
import logging
import os
from typing import Any, Dict, Optional

import resend
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr

from .convex_client import get_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/email", tags=["email"])

# Resend configuration
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
RESEND_WEBHOOK_SECRET = os.getenv("RESEND_WEBHOOK_SECRET")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY
    logger.info("✅ Resend API key configured")
else:
    logger.warning("⚠️ RESEND_API_KEY not configured - email sending will fail")

if RESEND_WEBHOOK_SECRET:
    logger.info("✅ Resend webhook secret configured")
else:
    logger.warning(
        "⚠️ RESEND_WEBHOOK_SECRET not configured - webhook verification disabled"
    )


class SendEmailRequest(BaseModel):
    to: EmailStr
    subject: str
    body: str
    from_email: Optional[str] = None
    html: Optional[str] = None  # Optional HTML version


class SendEmailResponse(BaseModel):
    success: bool
    message: str
    email_id: Optional[str] = None


def send_email_resend(
    to_email: str,
    subject: str,
    body: str,
    from_email: Optional[str] = None,
    html: Optional[str] = None,
) -> tuple[bool, Optional[str]]:
    """
    Send email via Resend API.

    Args:
        to_email: Recipient email address
        subject: Email subject
        body: Plain text email body
        from_email: Sender email (defaults to RESEND_FROM_EMAIL)
        html: Optional HTML version of body

    Returns:
        Tuple of (success: bool, email_id: Optional[str])
    """
    if not RESEND_API_KEY:
        logger.error("RESEND_API_KEY not configured")
        return False, None

    try:
        # Use provided from_email or fallback to env/default
        sender = from_email or RESEND_FROM_EMAIL

        # Convert plain text body to HTML if HTML not provided
        html_content = html or body.replace("\n", "<br>")

        # Send email via Resend
        params = {
            "from": sender,
            "to": to_email,
            "subject": subject,
            "html": html_content,
            "text": body,  # Plain text version
        }

        email_response = resend.Emails.send(params)

        # Handle different response formats
        if email_response:
            # Check if response has 'id' attribute
            if hasattr(email_response, "id"):
                email_id = email_response.id
                logger.info(
                    f"✅ Email sent successfully to {to_email} (ID: {email_id})"
                )
                return True, email_id
            # Check if response is a dict with 'id' key
            elif isinstance(email_response, dict) and "id" in email_response:
                email_id = email_response["id"]
                logger.info(
                    f"✅ Email sent successfully to {to_email} (ID: {email_id})"
                )
                return True, email_id
            else:
                logger.error(
                    f"Failed to send email: Unexpected response format: {email_response}"
                )
                logger.error(f"Response type: {type(email_response)}")
                return False, None
        else:
            logger.error(f"Failed to send email: No response from Resend")
            return False, None

    except Exception as e:
        logger.error(f"Failed to send email via Resend: {e}")
        return False, None


@router.post("/send", response_model=SendEmailResponse)
async def send_email(request: SendEmailRequest):
    """
    Send email via Resend API.

    Used for OTP verification, password resets, and notifications.
    """
    try:
        success, email_id = send_email_resend(
            to_email=request.to,
            subject=request.subject,
            body=request.body,
            from_email=request.from_email,
            html=request.html,
        )

        if success:
            return SendEmailResponse(
                success=True,
                message="Email sent successfully",
                email_id=email_id,
            )
        else:
            return SendEmailResponse(
                success=False,
                message="Email service not configured. Please set RESEND_API_KEY environment variable.",
                email_id=None,
            )

    except Exception as e:
        logger.error(f"Email sending error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


# ============================================================================
# Webhook Endpoints for Receiving Emails
# ============================================================================


class EmailReceivedEvent(BaseModel):
    """Resend webhook event for received emails"""

    type: str
    created_at: str
    data: Dict[str, Any]


def verify_webhook_signature(body: bytes, signature: Optional[str]) -> bool:
    """
    Verify Resend webhook signature using HMAC-SHA256.

    Args:
        body: Raw request body bytes
        signature: Signature from X-Resend-Signature header

    Returns:
        True if signature is valid, False otherwise
    """
    if not RESEND_WEBHOOK_SECRET:
        logger.warning(
            "⚠️ Webhook secret not configured - skipping signature verification"
        )
        return True  # Allow if secret not configured (for development)

    if not signature:
        logger.warning("⚠️ No signature provided in webhook request")
        return False

    try:
        # Resend uses HMAC-SHA256
        expected_signature = hmac.new(
            RESEND_WEBHOOK_SECRET.encode(), body, hashlib.sha256
        ).hexdigest()

        # Compare signatures (constant-time comparison)
        return hmac.compare_digest(signature, expected_signature)
    except Exception as e:
        logger.error(f"Error verifying webhook signature: {e}")
        return False


async def store_email_to_convex(email_data: Dict[str, Any]) -> bool:
    """
    Store received email in Convex database.

    Args:
        email_data: Email metadata (from, to, subject, etc.)

    Returns:
        True if stored successfully, False otherwise
    """
    try:
        convex_client = get_client()
        if not convex_client:
            logger.warning("⚠️ Convex client not available - email not stored")
            return False

        # Call Convex mutation to store email
        result = convex_client.mutation(
            "emails:storeReceived",
            {
                "emailId": email_data.get("email_id"),
                "fromEmail": email_data.get("from"),
                "toEmails": email_data.get("to", []),
                "subject": email_data.get("subject", ""),
                "receivedAt": email_data.get("created_at"),
                "attachments": email_data.get("attachments", []),
            },
        )

        if result:
            logger.info(f"✅ Email stored in Convex: {email_data.get('email_id')}")
            return True
        else:
            logger.warning(f"⚠️ Failed to store email in Convex")
            return False
    except Exception as e:
        logger.error(f"Error storing email to Convex: {e}")
        return False


async def send_auto_reply(to_email: str, original_subject: str) -> bool:
    """
    Send automated reply to received email.

    Args:
        to_email: Email address to reply to
        original_subject: Subject of the original email

    Returns:
        True if sent successfully, False otherwise
    """
    try:
        subject = f"Re: {original_subject}"
        body = f"""
Thank you for contacting RL Studio!

We have received your email and will get back to you soon.

This is an automated response.

Best regards,
RL Studio Team
        """.strip()

        success, _ = send_email_resend(
            to_email=to_email,
            subject=subject,
            body=body,
        )

        if success:
            logger.info(f"✅ Auto-reply sent to {to_email}")
        return success
    except Exception as e:
        logger.error(f"Error sending auto-reply: {e}")
        return False


@router.post("/webhook/receive")
async def receive_email_webhook(
    request: Request,
    x_resend_signature: Optional[str] = Header(None, alias="X-Resend-Signature"),
):
    """
    Webhook endpoint for receiving emails from Resend.

    Features:
    - Signature verification for security
    - Stores emails in Convex database
    - Sends auto-replies (if enabled)
    - Handles all Resend event types

    Configure webhook URL in Resend dashboard.
    For local dev, use ngrok: https://your-id.ngrok.io/api/email/webhook/receive
    """
    try:
        # Get raw body for signature verification (must be done before parsing JSON)
        body_bytes = await request.body()

        # Parse JSON after getting raw bytes
        body = json.loads(body_bytes.decode("utf-8"))

        # Verify webhook signature (security)
        if RESEND_WEBHOOK_SECRET:
            if not verify_webhook_signature(body_bytes, x_resend_signature):
                logger.warning("⚠️ Invalid webhook signature - rejecting request")
                raise HTTPException(status_code=401, detail="Invalid webhook signature")

        event_type = body.get("type", "unknown")
        logger.info(f"📧 Received webhook event: {event_type}")

        # Handle email.received event
        if event_type == "email.received":
            event_data = body.get("data", {})

            # Extract email information
            email_id = event_data.get("email_id")
            from_email = event_data.get("from")
            to_emails = event_data.get("to", [])
            subject = event_data.get("subject", "")
            attachments = event_data.get("attachments", [])
            created_at = event_data.get("created_at")

            logger.info(f"📬 Email received:")
            logger.info(f"   From: {from_email}")
            logger.info(f"   To: {to_emails}")
            logger.info(f"   Subject: {subject}")
            logger.info(f"   Email ID: {email_id}")
            logger.info(f"   Attachments: {len(attachments)}")

            # Store email in Convex database
            email_data = {
                "email_id": email_id,
                "from": from_email,
                "to": to_emails,
                "subject": subject,
                "attachments": attachments,
                "created_at": created_at,
            }

            stored = await store_email_to_convex(email_data)
            if not stored:
                logger.warning(
                    "⚠️ Email not stored in database, but continuing processing"
                )

            # Send auto-reply (optional - can be disabled)
            auto_reply_enabled = (
                os.getenv("EMAIL_AUTO_REPLY_ENABLED", "true").lower() == "true"
            )
            if auto_reply_enabled and from_email:
                await send_auto_reply(from_email, subject)

            # TODO: Add more processing as needed:
            # - Forward to support team
            # - Process attachments
            # - Route based on email address
            # - Trigger notifications
            # - etc.

            return {
                "success": True,
                "message": "Email received and processed",
                "email_id": email_id,
                "stored": stored,
            }

        # Handle other event types
        elif event_type in [
            "email.sent",
            "email.delivered",
            "email.bounced",
            "email.complained",
        ]:
            logger.info(f"📧 Email event: {event_type}")
            # You can store these events too if needed
            return {"success": True, "message": f"Event {event_type} received"}

        else:
            logger.info(f"📧 Unknown webhook event type: {event_type}")
            return {"success": True, "message": "Event received"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing webhook: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to process webhook: {str(e)}"
        )


# ============================================================================
# Test Endpoints for Email Sending
# ============================================================================


class TestEmailRequest(BaseModel):
    """Request model for testing email sending"""

    to: EmailStr
    email_type: str = "otp"  # Options: otp, welcome, notification, custom
    custom_subject: Optional[str] = None
    custom_body: Optional[str] = None


@router.post("/test/send", response_model=SendEmailResponse)
async def test_send_email(request: TestEmailRequest):
    """
    Test endpoint for sending different email types.

    Email types: otp, welcome, notification, custom
    """
    try:
        # Generate email content based on type
        if request.email_type == "otp":
            subject = "Your Verification Code"
            body = f"""
Hello!

Your verification code is: 123456

Enter this code to verify your email address.

This code expires in 15 minutes.

If you didn't request this, please ignore this email.

Best regards,
RL Studio Team
            """.strip()
            html = None

        elif request.email_type == "welcome":
            subject = "Welcome to RL Studio!"
            body = f"""
Welcome to RL Studio!

We're excited to have you on board. Get started by creating your first environment.

Best regards,
RL Studio Team
            """.strip()
            html = """
            <html>
            <body>
                <h1>Welcome to RL Studio!</h1>
                <p>We're excited to have you on board. Get started by creating your first environment.</p>
                <p>Best regards,<br>RL Studio Team</p>
            </body>
            </html>
            """

        elif request.email_type == "notification":
            subject = "RL Studio Notification"
            body = f"""
Hello!

This is a notification from RL Studio.

Best regards,
RL Studio Team
            """.strip()
            html = None

        elif request.email_type == "custom":
            if not request.custom_subject or not request.custom_body:
                raise HTTPException(
                    status_code=400,
                    detail="custom_subject and custom_body are required for custom email type",
                )
            subject = request.custom_subject
            body = request.custom_body
            html = None

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid email_type: {request.email_type}. Must be one of: otp, welcome, notification, custom",
            )

        # Send email
        success, email_id = send_email_resend(
            to_email=request.to,
            subject=subject,
            body=body,
            html=html,
        )

        if success:
            return SendEmailResponse(
                success=True,
                message=f"Test {request.email_type} email sent successfully",
                email_id=email_id,
            )
        else:
            return SendEmailResponse(
                success=False,
                message="Failed to send test email. Check RESEND_API_KEY configuration.",
                email_id=None,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Test email sending error: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to send test email: {str(e)}"
        )


@router.get("/test/status")
async def test_email_status():
    """Check email service configuration status."""
    has_api_key = bool(RESEND_API_KEY)
    from_email = RESEND_FROM_EMAIL

    return {
        "resend_configured": has_api_key,
        "from_email": from_email,
        "api_key_set": has_api_key,
        "message": (
            "Email service is ready" if has_api_key else "RESEND_API_KEY not configured"
        ),
    }
