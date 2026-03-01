import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from src.config.settings import settings

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)


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
) -> None:
    """Send a submission receipt email. Silently skips if SMTP is not configured."""
    if not _smtp_configured():
        logger.info("SMTP not configured — skipping submission receipt email")
        return

    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    from_name = settings.SMTP_FROM_NAME

    subject = f"Submission Received — {assignment_title} ({course_code})"

    html_body = f"""\
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 8px 0; color: #1a1a1a;">Submission Received</h2>
    <p style="margin: 0; color: #666;">Your assignment has been submitted successfully.</p>
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

    plain_body = (
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

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(plain_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        logger.info("Submission receipt sent to %s", to_email)
    except Exception:
        logger.exception("Failed to send submission receipt to %s", to_email)
