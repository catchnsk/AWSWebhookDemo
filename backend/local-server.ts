import express, { Request, Response } from 'express';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// Import Lambda handlers
import { handler as producerOnboardingHandler } from './lambda/producer-onboarding/index';
import { handler as schemaAdminHandler } from './lambda/schema-admin/index';
import { handler as subscriptionAdminHandler } from './lambda/subscription-admin/index';
import { handler as eventPublisherHandler } from './lambda/event-publisher/index';

/**
 * Convert Express request to API Gateway event
 */
function createAPIGatewayEvent(req: Request): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(req.body),
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

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (req, res) => {
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
  console.log('   GET    /health');
  console.log('');
  console.log('🎉 Ready to accept requests!');
});

export default app;
