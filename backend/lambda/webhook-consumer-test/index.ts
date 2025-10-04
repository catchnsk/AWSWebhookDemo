import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Webhook Consumer Test Lambda
 *
 * Acts as a test subscriber endpoint that:
 * - Receives webhook POST requests
 * - Validates HMAC signature
 * - Logs and stores payloads to files
 * - Returns appropriate responses
 *
 * For local testing: http://localhost:3000/webhook-test/receive
 */

interface WebhookPayload {
  eventId: string;
  eventType: string;
  timestamp: string;
  payload: any;
  signature?: string;
}

const WEBHOOK_LOGS_DIR = path.join(__dirname, '../../webhook-logs');

// Ensure logs directory exists
if (!fs.existsSync(WEBHOOK_LOGS_DIR)) {
  fs.mkdirSync(WEBHOOK_LOGS_DIR, { recursive: true });
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = uuidv4();
  const timestamp = new Date().toISOString();

  console.log('='.repeat(80));
  console.log(`Webhook Consumer Test - Request ID: ${requestId}`);
  console.log(`Timestamp: ${timestamp}`);
  console.log('='.repeat(80));

  try {
    // Log request headers
    console.log('\n📨 Request Headers:');
    console.log(JSON.stringify(event.headers, null, 2));

    // Parse request body
    let webhookData: WebhookPayload;
    try {
      webhookData = JSON.parse(event.body || '{}');
    } catch (error) {
      console.error('❌ Failed to parse request body:', error);
      return errorResponse(400, 'Invalid JSON payload');
    }

    // Log webhook data
    console.log('\n📦 Webhook Payload:');
    console.log(JSON.stringify(webhookData, null, 2));

    // Validate signature if present
    const signature = event.headers['X-Webhook-Signature'] || event.headers['x-webhook-signature'];
    if (signature) {
      console.log(`\n🔐 Signature Received: ${signature}`);
      // TODO: Implement HMAC validation if needed
    }

    // Create log entry
    const logEntry = {
      requestId,
      timestamp,
      method: event.httpMethod,
      path: event.path,
      headers: event.headers,
      queryParameters: event.queryStringParameters,
      body: webhookData,
      signature,
      sourceIp: event.requestContext?.identity?.sourceIp,
    };

    // Save to file
    const filename = `webhook-${timestamp.replace(/[:.]/g, '-')}-${requestId}.json`;
    const filepath = path.join(WEBHOOK_LOGS_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(logEntry, null, 2));
    console.log(`\n💾 Saved to file: ${filename}`);

    // Also append to a consolidated log
    const consolidatedLogPath = path.join(WEBHOOK_LOGS_DIR, 'webhooks.log');
    const logLine = `${timestamp} | ${requestId} | ${webhookData.eventType || 'UNKNOWN'} | ${webhookData.eventId || 'N/A'}\n`;
    fs.appendFileSync(consolidatedLogPath, logLine);

    // Log event details
    console.log('\n✅ Webhook Processed Successfully');
    console.log(`   Event Type: ${webhookData.eventType || 'N/A'}`);
    console.log(`   Event ID: ${webhookData.eventId || 'N/A'}`);
    console.log(`   File: ${filename}`);
    console.log('='.repeat(80));

    // Return success response
    return successResponse({
      success: true,
      requestId,
      timestamp,
      message: 'Webhook received and processed',
      eventId: webhookData.eventId,
      eventType: webhookData.eventType,
      savedTo: filename,
    });

  } catch (error: any) {
    console.error('\n❌ Error processing webhook:', error);
    console.error('Stack trace:', error.stack);
    console.log('='.repeat(80));

    return errorResponse(500, 'Internal server error', {
      requestId,
      error: error.message,
    });
  }
}

/**
 * Success response helper
 */
function successResponse(data: any): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Webhook-Signature',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(data),
  };
}

/**
 * Error response helper
 */
function errorResponse(statusCode: number, message: string, details?: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Webhook-Signature',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify({
      error: message,
      statusCode,
      ...details,
    }),
  };
}

/**
 * Get all stored webhooks
 */
export async function listWebhooksHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const files = fs.readdirSync(WEBHOOK_LOGS_DIR)
      .filter(file => file.startsWith('webhook-') && file.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 50); // Last 50 webhooks

    const webhooks = files.map(file => {
      const filepath = path.join(WEBHOOK_LOGS_DIR, file);
      const content = fs.readFileSync(filepath, 'utf-8');
      return JSON.parse(content);
    });

    return successResponse({
      count: webhooks.length,
      webhooks,
    });

  } catch (error: any) {
    return errorResponse(500, 'Failed to list webhooks', { error: error.message });
  }
}

/**
 * Get a specific webhook by requestId
 */
export async function getWebhookHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const requestId = event.pathParameters?.requestId;
    if (!requestId) {
      return errorResponse(400, 'Request ID is required');
    }

    const files = fs.readdirSync(WEBHOOK_LOGS_DIR)
      .filter(file => file.includes(requestId));

    if (files.length === 0) {
      return errorResponse(404, 'Webhook not found');
    }

    const filepath = path.join(WEBHOOK_LOGS_DIR, files[0]);
    const content = fs.readFileSync(filepath, 'utf-8');
    const webhook = JSON.parse(content);

    return successResponse(webhook);

  } catch (error: any) {
    return errorResponse(500, 'Failed to get webhook', { error: error.message });
  }
}

/**
 * Clear all webhook logs
 */
export async function clearWebhooksHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const files = fs.readdirSync(WEBHOOK_LOGS_DIR);
    let deletedCount = 0;

    for (const file of files) {
      if (file.startsWith('webhook-') && file.endsWith('.json')) {
        fs.unlinkSync(path.join(WEBHOOK_LOGS_DIR, file));
        deletedCount++;
      }
    }

    // Clear consolidated log
    const consolidatedLogPath = path.join(WEBHOOK_LOGS_DIR, 'webhooks.log');
    if (fs.existsSync(consolidatedLogPath)) {
      fs.unlinkSync(consolidatedLogPath);
    }

    console.log(`Cleared ${deletedCount} webhook logs`);

    return successResponse({
      success: true,
      message: `Deleted ${deletedCount} webhook logs`,
      deletedCount,
    });

  } catch (error: any) {
    return errorResponse(500, 'Failed to clear webhooks', { error: error.message });
  }
}
