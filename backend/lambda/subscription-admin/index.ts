import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createSubscription, getSubscriptionById, listSubscriptionsForSubscriber, cancelSubscription } from '../../shared/models/subscription';
import { getSubscriberByApiKey } from '../../shared/models/subscriber';
import { getSchemaById, getSchemaWithProducer } from '../../shared/models/schema';
import { sendSubscriptionConfirmationEmail } from '../../shared/utils/email';
import { successResponse, ErrorResponses, corsPreflightResponse, paginatedResponse } from '../../shared/utils/response';
import { isValidUrl } from '../../shared/utils/validation';
import { generateWebhookSecret } from '../../shared/utils/crypto';
import { initializeDatabase, query } from '../../shared/utils/database';

/**
 * Lambda handler for subscription management
 *
 * Requirement 3: Partner subscribes to a schema via API Exchange
 * Requirement 4: Subscription Admin API (store in DB + send email)
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Subscription Admin Lambda invoked', {
    httpMethod: event.httpMethod,
    path: event.path,
  });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    // Initialize database
    await initializeDatabase();

    const method = event.httpMethod;
    const resource = event.resource;

    // Route based on method and resource
    if (method === 'POST' && resource === '/subscriptions/subscribe') {
      return await handleSubscribe(event);
    }

    if (method === 'GET' && resource === '/subscriptions') {
      return await handleListSubscriptions(event);
    }

    if (method === 'GET' && resource === '/subscriptions/{subscriptionId}') {
      return await handleGetSubscription(event);
    }

    if (method === 'DELETE' && resource === '/subscriptions/{subscriptionId}') {
      return await handleCancelSubscription(event);
    }

    return ErrorResponses.badRequest('Invalid endpoint or method');
  } catch (error: any) {
    console.error('Error in subscription admin:', error);
    return ErrorResponses.internalServerError(
      process.env.NODE_ENV === 'development' ? error.message : 'Operation failed'
    );
  }
}

/**
 * Handle subscription creation
 * Requirement 3: Partner subscribes to a schema via API Exchange
 * Requirement 4a: Insert the schema subscription details in Webhook Database
 * Requirement 4b: Send the subscription information over email
 */
async function handleSubscribe(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Extract API key from Authorization header
  const apiKey = event.headers['Authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    return ErrorResponses.unauthorized('API key is required');
  }

  // Validate subscriber
  const subscriber = await getSubscriberByApiKey(apiKey);

  if (!subscriber) {
    return ErrorResponses.unauthorized('Invalid API key');
  }

  // Parse request body
  if (!event.body) {
    return ErrorResponses.badRequest('Request body is required');
  }

  let requestBody: any;
  try {
    requestBody = JSON.parse(event.body);
  } catch (error) {
    return ErrorResponses.badRequest('Invalid JSON in request body');
  }

  // Validate subscription request
  const validation = validateSubscriptionRequest(requestBody);
  if (!validation.valid) {
    return ErrorResponses.badRequest('Validation failed', validation.errors);
  }

  // Check if schema exists
  const schemaDetails = await getSchemaWithProducer(requestBody.schemaId);

  if (!schemaDetails) {
    return ErrorResponses.notFound('Schema', requestBody.schemaId);
  }

  const { schema, producer } = schemaDetails;

  // Check if schema is active
  if (schema.status !== 'active') {
    return ErrorResponses.badRequest('Schema is not active');
  }

  // Check if already subscribed
  const existingSubscription = await query(
    'SELECT id FROM subscriptions WHERE subscriber_id = $1 AND schema_id = $2 AND cancelled_at IS NULL',
    [subscriber.id, schema.id]
  );

  if (existingSubscription.rows.length > 0) {
    return ErrorResponses.conflict('Already subscribed to this schema');
  }

  try {
    // Generate webhook secret for this subscription
    const webhookSecret = generateWebhookSecret();

    // Use subscriber's default webhook URL or provided one
    const webhookUrl = requestBody.webhookUrl || subscriber.webhook_url;

    // Step 1: Create subscription in database
    console.log('Creating subscription in database...');
    const subscription = await createSubscription({
      subscriber_id: subscriber.id,
      schema_id: schema.id,
      webhook_url: webhookUrl,
      webhook_secret: webhookSecret,
      auth_type: requestBody.authType || subscriber.auth_type,
      auth_config: requestBody.authConfig,
      custom_headers: requestBody.customHeaders,
      enabled: requestBody.enabled !== false,
      max_retries: requestBody.maxRetries || 3,
      backoff_strategy: requestBody.backoffStrategy || 'exponential',
      initial_delay_ms: requestBody.initialDelayMs || 1000,
      timeout_ms: requestBody.timeoutMs || 30000,
      payload_filter: requestBody.payloadFilter,
    });

    console.log('Subscription created:', subscription.id);

    // Step 2: Send confirmation email
    console.log('Sending confirmation email...');
    try {
      await sendSubscriptionConfirmationEmail(
        subscriber.email,
        subscriber.name,
        {
          name: schema.name,
          eventType: schema.event_type,
          version: schema.version,
          description: schema.description,
        },
        webhookUrl,
        webhookSecret,
        schema.documentation_url
      );

      console.log('Confirmation email sent successfully');
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    // Prepare response
    const response = {
      subscription: {
        id: subscription.id,
        subscriberId: subscription.subscriber_id,
        schemaId: subscription.schema_id,
        webhookUrl: subscription.webhook_url,
        webhookSecret: subscription.webhook_secret, // Show secret only once
        authType: subscription.auth_type,
        enabled: subscription.enabled,
        maxRetries: subscription.max_retries,
        backoffStrategy: subscription.backoff_strategy,
        initialDelayMs: subscription.initial_delay_ms,
        timeoutMs: subscription.timeout_ms,
        status: subscription.status,
        approvalStatus: subscription.approval_status,
        createdAt: subscription.created_at,
      },
      schema: {
        name: schema.name,
        eventType: schema.event_type,
        version: schema.version,
      },
      message: 'Subscription created successfully. Confirmation email sent.',
    };

    return successResponse(response, 201);
  } catch (error: any) {
    console.error('Failed to create subscription:', error);

    // Check for unique constraint violation
    if (error.code === '23505') {
      return ErrorResponses.conflict('Already subscribed to this schema');
    }

    throw error;
  }
}

/**
 * Handle list subscriptions
 */
async function handleListSubscriptions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const apiKey = event.headers['Authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    return ErrorResponses.unauthorized('API key is required');
  }

  const subscriber = await getSubscriberByApiKey(apiKey);

  if (!subscriber) {
    return ErrorResponses.unauthorized('Invalid API key');
  }

  const params = event.queryStringParameters || {};
  const page = parseInt(params.page || '1', 10);
  const limit = parseInt(params.limit || '20', 10);

  const filters: any = {};
  if (params.status) filters.status = params.status;
  if (params.enabled) filters.enabled = params.enabled === 'true';

  const { subscriptions, total } = await listSubscriptionsForSubscriber(
    subscriber.id,
    filters,
    page,
    limit
  );

  // Fetch schema details for each subscription
  const subscriptionsWithDetails = await Promise.all(
    subscriptions.map(async (sub) => {
      const schema = await getSchemaById(sub.schema_id);
      return {
        id: sub.id,
        webhookUrl: sub.webhook_url,
        enabled: sub.enabled,
        status: sub.status,
        schema: {
          id: schema?.id,
          name: schema?.name,
          eventType: schema?.event_type,
          version: schema?.version,
        },
        statistics: {
          totalDeliveries: sub.total_deliveries,
          successfulDeliveries: sub.successful_deliveries,
          failedDeliveries: sub.failed_deliveries,
          successRate:
            sub.total_deliveries > 0
              ? ((sub.successful_deliveries / sub.total_deliveries) * 100).toFixed(2)
              : 0,
        },
        createdAt: sub.created_at,
      };
    })
  );

  const response = paginatedResponse(subscriptionsWithDetails, total, page, limit);

  return successResponse({ ...response, subscriptions: response.data });
}

/**
 * Handle get subscription details
 */
async function handleGetSubscription(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const apiKey = event.headers['Authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    return ErrorResponses.unauthorized('API key is required');
  }

  const subscriber = await getSubscriberByApiKey(apiKey);

  if (!subscriber) {
    return ErrorResponses.unauthorized('Invalid API key');
  }

  const subscriptionId = event.pathParameters?.subscriptionId;

  if (!subscriptionId) {
    return ErrorResponses.badRequest('Subscription ID is required');
  }

  const subscription = await getSubscriptionById(subscriptionId);

  if (!subscription || subscription.subscriber_id !== subscriber.id) {
    return ErrorResponses.notFound('Subscription', subscriptionId);
  }

  const schema = await getSchemaById(subscription.schema_id);

  const response = {
    id: subscription.id,
    subscriberId: subscription.subscriber_id,
    schemaId: subscription.schema_id,
    webhookUrl: subscription.webhook_url,
    authType: subscription.auth_type,
    customHeaders: subscription.custom_headers,
    enabled: subscription.enabled,
    maxRetries: subscription.max_retries,
    backoffStrategy: subscription.backoff_strategy,
    initialDelayMs: subscription.initial_delay_ms,
    timeoutMs: subscription.timeout_ms,
    status: subscription.status,
    approvalStatus: subscription.approval_status,
    schema: {
      id: schema?.id,
      name: schema?.name,
      eventType: schema?.event_type,
      version: schema?.version,
    },
    statistics: {
      totalDeliveries: subscription.total_deliveries,
      successfulDeliveries: subscription.successful_deliveries,
      failedDeliveries: subscription.failed_deliveries,
      avgLatencyMs: subscription.avg_latency_ms,
      consecutiveFailures: subscription.consecutive_failures,
    },
    lastDeliveryAt: subscription.last_delivery_at,
    createdAt: subscription.created_at,
    updatedAt: subscription.updated_at,
  };

  return successResponse(response);
}

/**
 * Handle cancel subscription
 */
async function handleCancelSubscription(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const apiKey = event.headers['Authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    return ErrorResponses.unauthorized('API key is required');
  }

  const subscriber = await getSubscriberByApiKey(apiKey);

  if (!subscriber) {
    return ErrorResponses.unauthorized('Invalid API key');
  }

  const subscriptionId = event.pathParameters?.subscriptionId;

  if (!subscriptionId) {
    return ErrorResponses.badRequest('Subscription ID is required');
  }

  const subscription = await getSubscriptionById(subscriptionId);

  if (!subscription || subscription.subscriber_id !== subscriber.id) {
    return ErrorResponses.notFound('Subscription', subscriptionId);
  }

  const cancelled = await cancelSubscription(subscriptionId);

  if (!cancelled) {
    return ErrorResponses.internalServerError('Failed to cancel subscription');
  }

  return successResponse(
    { message: 'Subscription cancelled successfully' },
    200
  );
}

/**
 * Validate subscription request
 */
function validateSubscriptionRequest(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.schemaId || typeof data.schemaId !== 'string') {
    errors.push('schemaId is required and must be a string');
  }

  if (data.webhookUrl && !isValidUrl(data.webhookUrl)) {
    errors.push('webhookUrl must be a valid HTTP or HTTPS URL');
  }

  if (data.maxRetries !== undefined) {
    const retries = parseInt(data.maxRetries, 10);
    if (isNaN(retries) || retries < 0 || retries > 10) {
      errors.push('maxRetries must be between 0 and 10');
    }
  }

  if (data.backoffStrategy && !['exponential', 'linear', 'constant'].includes(data.backoffStrategy)) {
    errors.push('backoffStrategy must be one of: exponential, linear, constant');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}