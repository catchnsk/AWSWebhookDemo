"""
Email service utility
Supports multiple email providers: Console (dev), SMTP, AWS SES, SendGrid
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def send_email(to, subject, html, text=None):
    """
    Send email using configured provider
    Returns True on success, False on failure
    """
    try:
        provider = os.environ.get('EMAIL_PROVIDER', 'console')

        if provider == 'smtp':
            return send_via_smtp(to, subject, html, text)
        elif provider == 'ses':
            return send_via_ses(to, subject, html, text)
        elif provider == 'sendgrid':
            return send_via_sendgrid(to, subject, html, text)
        else:
            # Development: Just log to console
            print('📧 Email (Console Mode):')
            print(f'  To: {to}')
            print(f'  Subject: {subject}')
            print(f'  HTML: {html[:100]}...')
            return True

    except Exception as error:
        print(f'Failed to send email: {error}')
        return False


def send_via_smtp(to, subject, html, text=None):
    """Send email via SMTP"""
    smtp_host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
    smtp_port = int(os.environ.get('SMTP_PORT', '587'))
    smtp_secure = os.environ.get('SMTP_SECURE', 'false').lower() == 'true'
    smtp_user = os.environ.get('SMTP_USER')
    smtp_password = os.environ.get('SMTP_PASSWORD')
    email_from = os.environ.get('EMAIL_FROM', 'noreply@example.com')

    # Create message
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = email_from
    msg['To'] = to

    # Add text and HTML parts
    if text:
        part1 = MIMEText(text, 'plain')
        msg.attach(part1)

    part2 = MIMEText(html, 'html')
    msg.attach(part2)

    # Send email
    if smtp_secure:
        server = smtplib.SMTP_SSL(smtp_host, smtp_port)
    else:
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()

    server.login(smtp_user, smtp_password)
    server.sendmail(email_from, to, msg.as_string())
    server.quit()

    return True


def send_via_ses(to, subject, html, text=None):
    """Send email via AWS SES"""
    # TODO: Implement AWS SES integration
    print(f'SES email would be sent to: {to}')
    print(f'Subject: {subject}')
    return True


def send_via_sendgrid(to, subject, html, text=None):
    """Send email via SendGrid"""
    # TODO: Implement SendGrid integration
    print(f'SendGrid email would be sent to: {to}')
    print(f'Subject: {subject}')
    return True


def send_welcome_email(email, name, verification_link):
    """
    Send welcome email with verification link
    Returns True on success, False on failure
    """
    html = f"""
<!DOCTYPE html>
<html>
<head>
  <style>
    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
    .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
    .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
    .button {{ display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
    .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Webhook Manager! 🎉</h1>
    </div>
    <div class="content">
      <h2>Hi {name},</h2>
      <p>Thank you for signing up! We're excited to have you on board.</p>

      <p>To get started, please verify your email address by clicking the button below:</p>

      <div style="text-align: center;">
        <a href="{verification_link}" class="button">Verify Email Address</a>
      </div>

      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #667eea;">{verification_link}</p>

      <p><strong>Note:</strong> This verification link will expire in 24 hours.</p>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">

      <h3>What's Next?</h3>
      <ul>
        <li>Verify your email to activate your account</li>
        <li>Log in to your dashboard</li>
        <li>Start managing your webhooks</li>
      </ul>

      <p>If you didn't create this account, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Webhook Manager. All rights reserved.</p>
      <p>Need help? Contact us at support@webhookmanager.com</p>
    </div>
  </div>
</body>
</html>
    """

    text = f"""
Welcome to Webhook Manager!

Hi {name},

Thank you for signing up! We're excited to have you on board.

To get started, please verify your email address by visiting this link:
{verification_link}

This verification link will expire in 24 hours.

What's Next?
- Verify your email to activate your account
- Log in to your dashboard
- Start managing your webhooks

If you didn't create this account, please ignore this email.

---
© 2025 Webhook Manager. All rights reserved.
Need help? Contact us at support@webhookmanager.com
    """

    return send_email(email, '🎉 Welcome to Webhook Manager - Verify Your Email', html, text)
