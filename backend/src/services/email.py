"""
Transactional email service.

Provider selection (in priority order)
---------------------------------------
1. Brevo (Sendinblue) — preferred.  Used when BREVO_API_KEY and
   BREVO_FROM_EMAIL are set in the environment.
2. SMTP — fallback.  Used when SMTP_HOST, SMTP_USER, and SMTP_PASSWORD
   are set.
3. No-op — if neither provider is configured, emails are silently skipped
   and a log line is emitted.  This allows the server to run in dev/test
   environments without email credentials.

All public send_* functions swallow exceptions internally and log them,
so a transient email failure never propagates to the API caller.

Emails sent
-----------
- Submission receipt  — sent to a student after a successful file upload.
- Assignment token    — sent to a student with their personalised
                        submission link and optional resubmission notice.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import requests

from src.config.settings import settings

logger = logging.getLogger(__name__)


# ── Provider detection ─────────────────────────────────────────────────────


def _brevo_configured() -> bool:
    return bool(settings.BREVO_API_KEY and settings.BREVO_FROM_EMAIL)


def _smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)


def _send_via_brevo(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    resp = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={
            "api-key": settings.BREVO_API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "sender": {"name": settings.BREVO_FROM_NAME, "email": settings.BREVO_FROM_EMAIL},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_body,
            "textContent": text_body,
        },
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Brevo API error {resp.status_code}: {resp.text}")


def _send_via_smtp(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    from_name = settings.SMTP_FROM_NAME

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


def _send_email(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    """Send an email via Brevo (preferred) or SMTP fallback."""
    if _brevo_configured():
        _send_via_brevo(to_email, subject, html_body, text_body)
        logger.info("Email sent via Brevo to %s", to_email)
    elif _smtp_configured():
        _send_via_smtp(to_email, subject, html_body, text_body)
        logger.info("Email sent via SMTP to %s", to_email)
    else:
        logger.info("No email provider configured — skipping email to %s", to_email)


# ── Helpers ────────────────────────────────────────────────────────────────


def _logo_html(logo_url: str | None) -> str:
    if not logo_url:
        return ""
    return (
        '<div style="text-align: center; margin-bottom: 20px;">'
        f'<img src="{logo_url}" alt="University Logo" '
        'style="max-height: 60px; max-width: 200px;" />'
        '</div>'
    )


def _fg_for_bg(hex_color: str) -> str:
    """Return '#ffffff' or '#000000' depending on background luminance."""
    h = hex_color.lstrip("#")
    if len(h) != 6:
        return "#ffffff"
    r, g, b = int(h[:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    luminance = 0.299 * r + 0.587 * g + 0.114 * b
    return "#ffffff" if luminance < 140 else "#000000"


# ── Submission receipt ─────────────────────────────────────────────────────


def send_submission_receipt(
    to_email: str,
    student_name: str,
    course_code: str,
    course_title: str,
    assignment_title: str,
    submission_id: str,
    submitted_at: str,
    file_count: int,
    language: str,
    logo_url: str | None = None,
    primary_color: str | None = None,
) -> None:
    """Send a submission receipt email. Silently skips if no provider is configured."""
    subject = f"Submission Received — {assignment_title} ({course_code})"
    logo_block = _logo_html(logo_url)
    accent = primary_color or "#2563eb"
    fg = _fg_for_bg(accent)

    html_body = f"""\
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {logo_block}
  <div style="background: {accent}; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 8px 0; color: {fg};">Submission Received</h2>
    <p style="margin: 0; color: {fg}; opacity: 0.85;">Your assignment has been submitted successfully.</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; color: #666; width: 140px;">Student</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-weight: 500;">{student_name}</td>
    </tr>
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; color: #666;">Course</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-weight: 500;">{course_code} — {course_title}</td>
    </tr>
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; color: #666;">Assignment</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-weight: 500;">{assignment_title}</td>
    </tr>
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; color: #666;">Language</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-weight: 500;">{language}</td>
    </tr>
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; color: #666;">Files</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-weight: 500;">{file_count} file(s)</td>
    </tr>
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; color: #666;">Submission ID</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-family: monospace; font-size: 13px;">{submission_id}</td>
    </tr>
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; color: #666;">Submitted at</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-weight: 500;">{submitted_at}</td>
    </tr>
  </table>

  <p style="color: #999; font-size: 12px; margin-top: 24px;">
    This is an automated confirmation. Please keep this email for your records.
  </p>
</div>
"""

    text_body = (
        f"Submission Received\n\n"
        f"Student: {student_name}\n"
        f"Course: {course_code} — {course_title}\n"
        f"Assignment: {assignment_title}\n"
        f"Language: {language}\n"
        f"Files: {file_count} file(s)\n"
        f"Submission ID: {submission_id}\n"
        f"Submitted at: {submitted_at}\n\n"
        f"This is an automated confirmation."
    )

    try:
        _send_email(to_email, subject, html_body, text_body)
    except Exception:
        logger.exception("Failed to send submission receipt to %s", to_email)


# ── Assignment token email ─────────────────────────────────────────────────


def send_assignment_token_email(
    to_email: str,
    student_name: str,
    course_code: str,
    course_title: str,
    assignment_title: str,
    submission_url: str,
    due_date: str = "",
    logo_url: str | None = None,
    primary_color: str | None = None,
    allow_resubmission: bool = False,
    token: str = "",
) -> None:
    """Send an assignment submission link to a student."""
    subject = f"Submit Your Work — {assignment_title} ({course_code})"
    logo_block = _logo_html(logo_url)
    accent = primary_color or "#2563eb"
    fg = _fg_for_bg(accent)

    due_row = ""
    due_plain = ""
    if due_date:
        due_row = f"""
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; color: #666; width: 140px;">Due Date</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-weight: 500;">{due_date}</td>
    </tr>"""
        due_plain = f"Due Date: {due_date}\n"

    resub_note = ""
    resub_plain = ""
    if allow_resubmission:
        resub_note = """
  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px;">
    <p style="margin: 0; color: #166534; font-size: 13px;">
      <strong>Resubmission allowed</strong> — You can use this same link to resubmit before the deadline. Your latest submission will replace the previous one.
    </p>
  </div>"""
        resub_plain = "Resubmission is allowed — use the same link to resubmit before the deadline.\n"

    token_section = ""
    token_plain = ""
    if token:
        token_section = f"""
  <div style="background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px;">
    <p style="margin: 0 0 6px 0; color: #666; font-size: 12px;">Your submission token (for manual entry):</p>
    <p style="margin: 0; font-family: monospace; font-size: 11px; word-break: break-all; color: #333;">{token}</p>
  </div>"""
        token_plain = f"\nSubmission Token (for manual entry):\n{token}\n"

    html_body = f"""\
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {logo_block}
  <div style="background: {accent}; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 8px 0; color: {fg};">Assignment Submission Link</h2>
    <p style="margin: 0; color: {fg}; opacity: 0.85;">Hi {student_name}, you have a new assignment to submit.</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; color: #666; width: 140px;">Course</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-weight: 500;">{course_code} — {course_title}</td>
    </tr>
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; color: #666;">Assignment</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-weight: 500;">{assignment_title}</td>
    </tr>{due_row}
  </table>
  {resub_note}
  <div style="text-align: center; margin: 24px 0;">
    <a href="{submission_url}" style="display: inline-block; background: {accent}; color: {fg}; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
      Submit Assignment
    </a>
  </div>
  {token_section}
  <p style="color: #999; font-size: 12px; margin-top: 24px;">
    If the button doesn't work, copy and paste this link into your browser:<br/>
    <a href="{submission_url}" style="color: {accent}; word-break: break-all;">{submission_url}</a>
  </p>
</div>
"""

    text_body = (
        f"Assignment Submission Link\n\n"
        f"Hi {student_name},\n\n"
        f"Course: {course_code} — {course_title}\n"
        f"Assignment: {assignment_title}\n"
        f"{due_plain}"
        f"{resub_plain}\n"
        f"Submit your work here:\n{submission_url}\n"
        f"{token_plain}\n"
        f"This is an automated message."
    )

    try:
        _send_email(to_email, subject, html_body, text_body)
    except Exception:
        logger.exception("Failed to send assignment token email to %s", to_email)
