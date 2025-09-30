import { SESClient, SendEmailCommand, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

let sesClient: SESClient | null = null;
let snsClient: SNSClient | null = null;

/**
 * Initialize AWS SES client
 */
function getSESClient(): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return sesClient;
}

/**
 * Initialize AWS SNS client
 */
function getSNSClient(): SNSClient {
  if (!snsClient) {
    snsClient = new SNSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return snsClient;
}

/**
 * Email configuration
 */
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@webhooks.example.com';
const FROM_NAME = process.env.FROM_NAME || 'Webhook Management System';

/**
 * Send email via AWS SES
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  isHtml: boolean = true
): Promise<{ messageId: string; success: boolean }> {
  const client = getSESClient();

  try {
    const command = new SendEmailCommand({
      Source: `${FROM_NAME} <${FROM_EMAIL}>`,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: isHtml
          ? {
              Html: {
                Data: body,
                Charset: 'UTF-8',
              },
            }
          : {
              Text: {
                Data: body,
                Charset: 'UTF-8',
              },
            },
      },
    });

    const response = await client.send(command);

    console.log('Email sent successfully:', { to, subject, messageId: response.MessageId });

    return {
      messageId: response.MessageId!,
      success: true,
    };
  } catch (error: any) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

/**
 * Send subscription confirmation email
 */
export async function sendSubscriptionConfirmationEmail(
  subscriberEmail: string,
  subscriberName: string,
  schemaDetails: {
    name: string;
    eventType: string;
    version: string;
    description?: string;
  },
  webhookUrl: string,
  webhookSecret: string,
  documentationUrl?: string
): Promise<void> {
  const subject = `✓ Your Subscription to "${schemaDetails.name}" is Active`;

  const body = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .detail-box { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #4CAF50; }
    .code { background-color: #f4f4f4; padding: 10px; font-family: monospace; overflow-x: auto; }
    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Subscription Confirmed!</h1>
    </div>

    <div class="content">
      <p>Hi ${subscriberName},</p>

      <p>Your subscription to the <strong>"${schemaDetails.name}"</strong> event schema has been successfully activated!</p>

      <div class="detail-box">
        <h3>📋 Schema Details</h3>
        <ul>
          <li><strong>Event Type:</strong> ${schemaDetails.eventType}</li>
          <li><strong>Version:</strong> ${schemaDetails.version}</li>
          ${schemaDetails.description ? `<li><strong>Description:</strong> ${schemaDetails.description}</li>` : ''}
        </ul>
      </div>

      <div class="detail-box">
        <h3>🔗 Webhook Configuration</h3>
        <p><strong>Your Webhook URL:</strong></p>
        <div class="code">${webhookUrl}</div>
      </div>

      <div class="warning">
        <h3>🔐 Webhook Secret (Keep Secure!)</h3>
        <p>Use this secret to verify webhook signatures:</p>
        <div class="code">${webhookSecret}</div>
        <p><strong>⚠️ Important:</strong> Store this secret securely. Never commit it to version control.</p>
      </div>

      <div class="detail-box">
        <h3>✅ What Happens Next?</h3>
        <ol>
          <li>Events matching this schema will be sent to your webhook URL</li>
          <li>Each webhook request includes an HMAC signature for verification</li>
          <li>You can monitor delivery status in your dashboard</li>
        </ol>
      </div>

      <div class="detail-box">
        <h3>🔒 Verifying Webhook Signatures</h3>
        <p>Each webhook request includes these headers:</p>
        <div class="code">
X-Webhook-Signature: t=1234567890,v1=abc123...
X-Webhook-Timestamp: 1234567890
        </div>
        <p>Use your webhook secret to verify the signature. Example (Node.js):</p>
        <div class="code">
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const [timestamp, hash] = signature.split(',')
    .map(s => s.split('=')[1]);

  const signedPayload = \`\${timestamp}.\${JSON.stringify(payload)}\`;
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(expectedHash)
  );
}
        </div>
      </div>

      ${
        documentationUrl
          ? `
      <div class="detail-box">
        <h3>📚 Documentation</h3>
        <p>View full schema documentation: <a href="${documentationUrl}">${documentationUrl}</a></p>
      </div>
      `
          : ''
      }

      <p>If you have any questions, please contact our support team.</p>

      <p>Best regards,<br>The Webhook Team</p>
    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} Webhook Management System. All rights reserved.</p>
      <p><a href="#">Manage Subscriptions</a> | <a href="#">API Documentation</a> | <a href="#">Support</a></p>
    </div>
  </div>
</body>
</html>
  `;

  await sendEmail(subscriberEmail, subject, body, true);
}

/**
 * Send delivery failure notification email
 */
export async function sendDeliveryFailureNotification(
  subscriberEmail: string,
  subscriberName: string,
  webhookUrl: string,
  eventType: string,
  errorMessage: string,
  totalAttempts: number,
  deliveryId: string
): Promise<void> {
  const subject = `⚠️ Webhook Delivery Failed - ${eventType}`;

  const body = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .alert { background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 10px 0; }
    .detail-box { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #dc3545; }
    .code { background-color: #f4f4f4; padding: 10px; font-family: monospace; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Webhook Delivery Failed</h1>
    </div>

    <div class="content">
      <p>Hi ${subscriberName},</p>

      <div class="alert">
        <strong>Alert:</strong> We were unable to deliver a webhook to your endpoint after ${totalAttempts} attempts.
      </div>

      <div class="detail-box">
        <h3>📋 Failure Details</h3>
        <ul>
          <li><strong>Webhook URL:</strong> ${webhookUrl}</li>
          <li><strong>Event Type:</strong> ${eventType}</li>
          <li><strong>Delivery ID:</strong> ${deliveryId}</li>
          <li><strong>Total Attempts:</strong> ${totalAttempts}</li>
        </ul>
      </div>

      <div class="detail-box">
        <h3>❌ Error Message</h3>
        <div class="code">${errorMessage}</div>
      </div>

      <div class="detail-box">
        <h3>🔧 Recommended Actions</h3>
        <ol>
          <li>Check if your webhook endpoint is accessible</li>
          <li>Verify your server is responding within 30 seconds</li>
          <li>Check your server logs for errors</li>
          <li>Test your webhook endpoint manually</li>
          <li>Update your webhook URL if it has changed</li>
        </ol>
      </div>

      <p>If this issue persists, please contact our support team or update your webhook configuration.</p>

      <p>Best regards,<br>The Webhook Team</p>
    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} Webhook Management System. All rights reserved.</p>
      <p><a href="#">View Dashboard</a> | <a href="#">Update Webhook</a> | <a href="#">Support</a></p>
    </div>
  </div>
</body>
</html>
  `;

  await sendEmail(subscriberEmail, subject, body, true);
}

/**
 * Send producer onboarding welcome email
 */
export async function sendProducerWelcomeEmail(
  producerEmail: string,
  producerName: string,
  apiKey: string,
  documentationUrl?: string
): Promise<void> {
  const subject = `Welcome to Webhook Management System - API Credentials`;

  const body = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .detail-box { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #007bff; }
    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 10px 0; }
    .code { background-color: #f4f4f4; padding: 10px; font-family: monospace; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 Welcome Onboard!</h1>
    </div>

    <div class="content">
      <p>Hi ${producerName},</p>

      <p>Welcome to the Webhook Management System! Your producer account has been successfully created.</p>

      <div class="warning">
        <h3>🔑 Your API Credentials</h3>
        <div class="code">${apiKey}</div>
        <p><strong>⚠️ Important:</strong> Store this API key securely. You won't be able to see it again.</p>
      </div>

      <div class="detail-box">
        <h3>🎯 Next Steps</h3>
        <ol>
          <li>Register your event schemas</li>
          <li>Publish events to the system</li>
          <li>Monitor subscriber engagement</li>
        </ol>
      </div>

      <div class="detail-box">
        <h3>📝 Register a Schema Example</h3>
        <div class="code">
curl -X POST https://api.webhooks.example.com/api/v1/schemas/register \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Order Created Event",
    "eventType": "order.created",
    "version": "1.0.0",
    "schemaDefinition": { ... }
  }'
        </div>
      </div>

      ${
        documentationUrl
          ? `
      <div class="detail-box">
        <h3>📚 Documentation</h3>
        <p>Get started: <a href="${documentationUrl}">${documentationUrl}</a></p>
      </div>
      `
          : ''
      }

      <p>If you have any questions, please contact our support team.</p>

      <p>Best regards,<br>The Webhook Team</p>
    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} Webhook Management System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  await sendEmail(producerEmail, subject, body, true);
}

/**
 * Send SNS notification
 */
export async function sendSNSNotification(
  topicArn: string,
  subject: string,
  message: string
): Promise<{ messageId: string; success: boolean }> {
  const client = getSNSClient();

  try {
    const command = new PublishCommand({
      TopicArn: topicArn,
      Subject: subject,
      Message: message,
    });

    const response = await client.send(command);

    console.log('SNS notification sent:', { topicArn, messageId: response.MessageId });

    return {
      messageId: response.MessageId!,
      success: true,
    };
  } catch (error) {
    console.error('Failed to send SNS notification:', error);
    throw error;
  }
}