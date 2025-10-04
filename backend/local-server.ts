import express, { Request, Response } from 'express';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// Enable CORS for local development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
});

// Import Lambda handlers
import { handler as producerOnboardingHandler } from './lambda/producer-onboarding/index';
import { handler as schemaAdminHandler } from './lambda/schema-admin/index';
import { handler as subscriptionAdminHandler } from './lambda/subscription-admin/index';
import { handler as eventPublisherHandler } from './lambda/event-publisher/index';
import { handler as eventAdminHandler } from './lambda/event-admin/index';
import { handler as adminUserManagerHandler } from './lambda/admin-user-manager/index';
import { handler as adminAuthHandler } from './lambda/admin-auth/index';
import {
  handler as webhookConsumerHandler,
  listWebhooksHandler,
  getWebhookHandler,
  clearWebhooksHandler
} from './lambda/webhook-consumer-test/index';

/**
 * Convert Express request to API Gateway event
 */
function createAPIGatewayEvent(req: Request): APIGatewayProxyEvent {
  return {
    body: req.body ? JSON.stringify(req.body) : null,
    headers: req.headers as { [name: string]: string },
    multiValueHeaders: {},
    httpMethod: req.method,
    isBase64Encoded: false,
    path: req.path,
    pathParameters: req.params,
    queryStringParameters: req.query as { [name: string]: string },
    multiValueQueryStringParameters: {},
    stageVariables: null,
    requestContext: {
      accountId: 'local',
      apiId: 'local',
      protocol: 'HTTP/1.1',
      httpMethod: req.method,
      path: req.path,
      stage: 'local',
      requestId: `local-${Date.now()}`,
      requestTime: new Date().toISOString(),
      requestTimeEpoch: Date.now(),
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: req.ip || '127.0.0.1',
        user: null,
        userAgent: req.headers['user-agent'] || 'local',
        userArn: null,
      },
      authorizer: null,
      domainName: 'localhost',
      domainPrefix: 'localhost',
      resourceId: 'local',
      resourcePath: req.path,
    },
    resource: req.path,
  } as APIGatewayProxyEvent;
}

/**
 * Mock Lambda context
 */
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'local',
  functionVersion: '1',
  invokedFunctionArn: 'local',
  memoryLimitInMB: '512',
  awsRequestId: 'local',
  logGroupName: 'local',
  logStreamName: 'local',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

/**
 * Lambda wrapper middleware
 */
async function lambdaWrapper(
  handler: (event: APIGatewayProxyEvent, context: Context) => Promise<any>,
  req: Request,
  res: Response
) {
  try {
    const event = createAPIGatewayEvent(req);
    const result = await handler(event, mockContext);

    res.status(result.statusCode).set(result.headers).send(result.body);
  } catch (error: any) {
    console.error('Lambda execution error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

// ============================================================================
// Producer Onboarding Routes
// ============================================================================

app.post('/api/v1/producers/onboard', async (req, res) => {
  await lambdaWrapper(producerOnboardingHandler, req, res);
});

// ============================================================================
// Schema Admin Routes
// ============================================================================

app.post('/api/v1/schemas/register', async (req, res) => {
  await lambdaWrapper(schemaAdminHandler, req, res);
});

app.get('/api/v1/schemas', async (req, res) => {
  await lambdaWrapper(schemaAdminHandler, req, res);
});

app.get('/api/v1/schemas/marketplace', async (req, res) => {
  await lambdaWrapper(schemaAdminHandler, req, res);
});

app.get('/api/v1/schemas/:schemaId', async (req, res) => {
  await lambdaWrapper(schemaAdminHandler, req, res);
});

app.post('/api/v1/schemas/:schemaId/validate', async (req, res) => {
  await lambdaWrapper(schemaAdminHandler, req, res);
});

// ============================================================================
// Admin Schema Routes
// ============================================================================

app.patch('/api/v1/admin/schemas/:schemaId', async (req, res) => {
  await lambdaWrapper(schemaAdminHandler, req, res);
});

// ============================================================================
// Subscriber Routes
// ============================================================================

app.get('/api/v1/subscribers', async (req, res) => {
  // Return subscribers list for admins
  const { Pool } = await import('pg');
  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });

  try {
    const result = await pool.query('SELECT id, name, email, webhook_url, status, created_at FROM subscribers ORDER BY created_at DESC');
    res.json({
      success: true,
      subscribers: result.rows
    });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  } finally {
    await pool.end();
  }
});

app.patch('/api/v1/subscribers/:subscriberId', async (req, res) => {
  // Update subscriber
  const { subscriberId } = req.params;
  const { name, email, webhookUrl, status } = req.body;

  const { Pool } = await import('pg');
  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });

  try {
    const updates = [];
    const values = [];
    let valueIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${valueIndex++}`);
      values.push(name);
    }
    if (email !== undefined) {
      updates.push(`email = $${valueIndex++}`);
      values.push(email);
    }
    if (webhookUrl !== undefined) {
      updates.push(`webhook_url = $${valueIndex++}`);
      values.push(webhookUrl);
    }
    if (status !== undefined) {
      updates.push(`status = $${valueIndex++}`);
      values.push(status);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(subscriberId);

    const query = `
      UPDATE subscribers
      SET ${updates.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING id, name, email, webhook_url, status, created_at, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      res.status(404).json({ error: { message: 'Subscriber not found' } });
    } else {
      res.json({
        success: true,
        subscriber: result.rows[0]
      });
    }
  } catch (error: any) {
    console.error('Error updating subscriber:', error);
    res.status(500).json({ error: { message: 'Failed to update subscriber' } });
  } finally {
    await pool.end();
  }
});

// ============================================================================
// Subscription Admin Routes
// ============================================================================

app.post('/api/v1/subscriptions/subscribe', async (req, res) => {
  await lambdaWrapper(subscriptionAdminHandler, req, res);
});

app.get('/api/v1/subscriptions', async (req, res) => {
  await lambdaWrapper(subscriptionAdminHandler, req, res);
});

app.get('/api/v1/subscriptions/:subscriptionId', async (req, res) => {
  await lambdaWrapper(subscriptionAdminHandler, req, res);
});

app.patch('/api/v1/subscriptions/:subscriptionId', async (req, res) => {
  await lambdaWrapper(subscriptionAdminHandler, req, res);
});

app.delete('/api/v1/subscriptions/:subscriptionId', async (req, res) => {
  await lambdaWrapper(subscriptionAdminHandler, req, res);
});

// ============================================================================
// Event Publisher Routes
// ============================================================================

app.post('/api/v1/events/publish', async (req, res) => {
  await lambdaWrapper(eventPublisherHandler, req, res);
});

app.get('/api/v1/events', async (req, res) => {
  await lambdaWrapper(eventAdminHandler, req, res);
});

// ============================================================================
// Delivery Routes
// ============================================================================

app.get('/api/v1/deliveries/stats', async (req, res) => {
  // Return mock stats for now
  res.json({
    success: true,
    data: {
      total: 0,
      success: 0,
      failed: 0,
      retrying: 0,
      pending: 0,
      successRate: 0,
      avgLatencyMs: 0
    }
  });
});

// ============================================================================
// DLQ Routes
// ============================================================================

app.get('/api/v1/admin/dlq', async (req, res) => {
  // Return empty DLQ list for now
  res.json({ success: true, data: { entries: [], total: 0 } });
});

// ============================================================================
// Admin Auth Routes
// ============================================================================

app.post('/api/v1/admin/login', async (req, res) => {
  await lambdaWrapper(adminAuthHandler, req, res);
});

// ============================================================================
// Admin User Manager Routes
// ============================================================================

app.post('/api/v1/admin/users', async (req, res) => {
  await lambdaWrapper(adminUserManagerHandler, req, res);
});

app.get('/api/v1/admin/users', async (req, res) => {
  await lambdaWrapper(adminUserManagerHandler, req, res);
});

app.get('/api/v1/admin/users/:userId', async (req, res) => {
  await lambdaWrapper(adminUserManagerHandler, req, res);
});

app.patch('/api/v1/admin/users/:userId', async (req, res) => {
  await lambdaWrapper(adminUserManagerHandler, req, res);
});

app.delete('/api/v1/admin/users/:userId', async (req, res) => {
  await lambdaWrapper(adminUserManagerHandler, req, res);
});

// ============================================================================
// Webhook Consumer Test Routes
// ============================================================================

// Receive webhook (test subscriber endpoint)
app.post('/webhook-test/receive', async (req, res) => {
  await lambdaWrapper(webhookConsumerHandler, req, res);
});

// Get all received webhooks
app.get('/webhook-test/webhooks', async (req, res) => {
  await lambdaWrapper(listWebhooksHandler, req, res);
});

// Get specific webhook by requestId
app.get('/webhook-test/webhooks/:requestId', async (req, res) => {
  await lambdaWrapper(getWebhookHandler, req, res);
});

// Clear all webhook logs
app.delete('/webhook-test/webhooks', async (req, res) => {
  await lambdaWrapper(clearWebhooksHandler, req, res);
});

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ============================================================================
// Start Server
// ============================================================================

const PORT = process.env.API_PORT || 3000;

app.listen(PORT, () => {
  console.log('🚀 Webhook Management System - Local Development Server');
  console.log('================================================');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🗄️  PostgreSQL: ${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}`);
  console.log(`📨 Kafka: ${process.env.KAFKA_BROKERS}`);
  console.log('');
  console.log('📚 Available endpoints:');
  console.log('   POST   /api/v1/producers/onboard');
  console.log('   POST   /api/v1/schemas/register');
  console.log('   GET    /api/v1/schemas');
  console.log('   GET    /api/v1/schemas/marketplace');
  console.log('   POST   /api/v1/subscriptions/subscribe');
  console.log('   GET    /api/v1/subscriptions');
  console.log('   POST   /api/v1/events/publish');
  console.log('   POST   /api/v1/admin/users');
  console.log('   GET    /api/v1/admin/users');
  console.log('   GET    /health');
  console.log('');
  console.log('🧪 Test Webhook Consumer:');
  console.log('   POST   /webhook-test/receive           (Receive webhooks)');
  console.log('   GET    /webhook-test/webhooks          (List all webhooks)');
  console.log('   GET    /webhook-test/webhooks/:id      (Get specific webhook)');
  console.log('   DELETE /webhook-test/webhooks          (Clear all webhooks)');
  console.log('');
  console.log('🎉 Ready to accept requests!');
});

export default app;
