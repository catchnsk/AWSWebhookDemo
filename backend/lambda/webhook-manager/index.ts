import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  getWebhookById,
  listWebhooks,
  updateWebhook,
  deleteWebhook,
  toggleWebhookStatus,
  regenerateWebhookSecret,
  bulkUpdateWebhooks,
} from '../../shared/models/webhook';
import {
  successResponse,
  errorResponse,
  ErrorResponses,
  corsPreflightResponse,
  paginatedResponse,
} from '../../shared/utils/response';
import { validatePagination, isValidUuid } from '../../shared/utils/validation';
import { generateWebhookSecret } from '../../shared/utils/crypto';
import { initializeDatabase } from '../../shared/utils/database';

/**
 * Lambda handler for webhook management operations
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Webhook Manager Lambda invoked', {
    httpMethod: event.httpMethod,
    path: event.path,
    resource: event.resource,
  });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    // Initialize database connection
    await initializeDatabase();

    // Extract user ID from authorizer
    const userId = event.requestContext.authorizer?.principalId || event.requestContext.authorizer?.claims?.sub;

    if (!userId) {
      return ErrorResponses.unauthorized('User authentication required');
    }

    // Route based on HTTP method and path
    const method = event.httpMethod;
    const resource = event.resource;

    // List webhooks: GET /webhooks
    if (method === 'GET' && resource === '/webhooks') {
      return await handleListWebhooks(event, userId);
    }

    // Get webhook details: GET /webhooks/{webhookId}
    if (method === 'GET' && resource === '/webhooks/{webhookId}') {
      return await handleGetWebhook(event, userId);
    }

    // Update webhook: PUT /webhooks/{webhookId}
    if (method === 'PUT' && resource === '/webhooks/{webhookId}') {
      return await handleUpdateWebhook(event, userId);
    }

    // Delete webhook: DELETE /webhooks/{webhookId}
    if (method === 'DELETE' && resource === '/webhooks/{webhookId}') {
      return await handleDeleteWebhook(event, userId);
    }

    // Toggle webhook status: PATCH /webhooks/{webhookId}/status
    if (method === 'PATCH' && resource === '/webhooks/{webhookId}/status') {
      return await handleToggleStatus(event, userId);
    }

    // Regenerate secret: POST /webhooks/{webhookId}/regenerate-secret
    if (method === 'POST' && resource === '/webhooks/{webhookId}/regenerate-secret') {
      return await handleRegenerateSecret(event, userId);
    }

    // Bulk operations: POST /webhooks/bulk
    if (method === 'POST' && resource === '/webhooks/bulk') {
      return await handleBulkOperations(event, userId);
    }

    return ErrorResponses.badRequest('Invalid endpoint or method');
  } catch (error: any) {
    console.error('Error in webhook manager:', error);
    return ErrorResponses.internalServerError(
      process.env.NODE_ENV === 'development' ? error.message : 'Operation failed'
    );
  }
}

/**
 * Handle list webhooks
 */
async function handleListWebhooks(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};

  // Validate pagination
  const { page, limit, errors } = validatePagination(params.page, params.limit);
  if (errors.length > 0) {
    return ErrorResponses.badRequest('Invalid pagination parameters', errors);
  }

  // Build filters
  const filters: any = { user_id: userId };

  if (params.status) filters.status = params.status;
  if (params.enabled) filters.enabled = params.enabled === 'true';
  if (params.eventType) filters.event_type = params.eventType;
  if (params.tags) filters.tags = params.tags.split(',');
  if (params.search) filters.search = params.search;

  const sortBy = params.sortBy || 'created_at';
  const sortOrder = (params.sortOrder?.toLowerCase() as 'asc' | 'desc') || 'desc';

  const { webhooks, total } = await listWebhooks(filters, page, limit, sortBy, sortOrder);

  // Transform webhooks for response
  const transformedWebhooks = webhooks.map((webhook) => ({
    id: webhook.id,
    name: webhook.name,
    url: webhook.url,
    eventType: webhook.event_type,
    status: webhook.status,
    enabled: webhook.enabled,
    tags: webhook.tags,
    statistics: {
      totalDeliveries: webhook.total_deliveries,
      successRate:
        webhook.total_deliveries > 0
          ? ((webhook.successful_deliveries / webhook.total_deliveries) * 100).toFixed(2)
          : 0,
      avgLatencyMs: webhook.avg_latency_ms,
    },
    lastTriggeredAt: webhook.last_triggered_at,
    createdAt: webhook.created_at,
  }));

  const response = paginatedResponse(transformedWebhooks, total, page, limit);

  return successResponse({ ...response, webhooks: response.data });
}

/**
 * Handle get webhook by ID
 */
async function handleGetWebhook(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const webhookId = event.pathParameters?.webhookId;

  if (!webhookId || !isValidUuid(webhookId)) {
    return ErrorResponses.badRequest('Invalid webhook ID');
  }

  const webhook = await getWebhookById(webhookId, userId);

  if (!webhook) {
    return ErrorResponses.notFound('Webhook', webhookId);
  }

  const response = {
    id: webhook.id,
    name: webhook.name,
    url: webhook.url,
    description: webhook.description,
    eventType: webhook.event_type,
    schemaId: webhook.schema_id,
    authentication: { type: webhook.auth_type },
    retryPolicy: {
      maxRetries: webhook.max_retries,
      backoffStrategy: webhook.backoff_strategy,
      initialDelayMs: webhook.initial_delay_ms,
    },
    timeoutMs: webhook.timeout_ms,
    headers: webhook.custom_headers,
    enabled: webhook.enabled,
    status: webhook.status,
    tags: webhook.tags,
    secret: webhook.secret,
    statistics: {
      totalDeliveries: webhook.total_deliveries,
      successfulDeliveries: webhook.successful_deliveries,
      failedDeliveries: webhook.failed_deliveries,
      successRate:
        webhook.total_deliveries > 0
          ? ((webhook.successful_deliveries / webhook.total_deliveries) * 100).toFixed(2)
          : 0,
      avgLatencyMs: webhook.avg_latency_ms,
      consecutiveFailures: webhook.consecutive_failures,
    },
    lastTriggeredAt: webhook.last_triggered_at,
    lastSuccessAt: webhook.last_success_at,
    lastFailureAt: webhook.last_failure_at,
    createdAt: webhook.created_at,
    updatedAt: webhook.updated_at,
  };

  return successResponse(response);
}

/**
 * Handle update webhook
 */
async function handleUpdateWebhook(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const webhookId = event.pathParameters?.webhookId;

  if (!webhookId || !isValidUuid(webhookId)) {
    return ErrorResponses.badRequest('Invalid webhook ID');
  }

  if (!event.body) {
    return ErrorResponses.badRequest('Request body is required');
  }

  let updateData: any;
  try {
    updateData = JSON.parse(event.body);
  } catch (error) {
    return ErrorResponses.badRequest('Invalid JSON in request body');
  }

  const updatedWebhook = await updateWebhook(webhookId, userId, updateData);

  if (!updatedWebhook) {
    return ErrorResponses.notFound('Webhook', webhookId);
  }

  const response = {
    id: updatedWebhook.id,
    name: updatedWebhook.name,
    url: updatedWebhook.url,
    description: updatedWebhook.description,
    enabled: updatedWebhook.enabled,
    status: updatedWebhook.status,
    updatedAt: updatedWebhook.updated_at,
  };

  return successResponse(response, 200, 'Webhook updated successfully');
}

/**
 * Handle delete webhook
 */
async function handleDeleteWebhook(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const webhookId = event.pathParameters?.webhookId;

  if (!webhookId || !isValidUuid(webhookId)) {
    return ErrorResponses.badRequest('Invalid webhook ID');
  }

  const deleted = await deleteWebhook(webhookId, userId);

  if (!deleted) {
    return ErrorResponses.notFound('Webhook', webhookId);
  }

  return {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGINS?.split(',')[0] || '*',
      'Access-Control-Allow-Credentials': 'true',
    },
    body: '',
  };
}

/**
 * Handle toggle webhook status
 */
async function handleToggleStatus(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const webhookId = event.pathParameters?.webhookId;

  if (!webhookId || !isValidUuid(webhookId)) {
    return ErrorResponses.badRequest('Invalid webhook ID');
  }

  if (!event.body) {
    return ErrorResponses.badRequest('Request body is required');
  }

  let body: any;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    return ErrorResponses.badRequest('Invalid JSON in request body');
  }

  if (typeof body.enabled !== 'boolean') {
    return ErrorResponses.badRequest('enabled field must be a boolean');
  }

  const updatedWebhook = await toggleWebhookStatus(webhookId, userId, body.enabled);

  if (!updatedWebhook) {
    return ErrorResponses.notFound('Webhook', webhookId);
  }

  const response = {
    id: updatedWebhook.id,
    enabled: updatedWebhook.enabled,
    updatedAt: updatedWebhook.updated_at,
  };

  return successResponse(response, 200, 'Webhook status updated successfully');
}

/**
 * Handle regenerate webhook secret
 */
async function handleRegenerateSecret(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const webhookId = event.pathParameters?.webhookId;

  if (!webhookId || !isValidUuid(webhookId)) {
    return ErrorResponses.badRequest('Invalid webhook ID');
  }

  const newSecret = generateWebhookSecret();
  const updatedWebhook = await regenerateWebhookSecret(webhookId, userId, newSecret);

  if (!updatedWebhook) {
    return ErrorResponses.notFound('Webhook', webhookId);
  }

  const response = {
    id: updatedWebhook.id,
    secret: updatedWebhook.secret,
    updatedAt: updatedWebhook.updated_at,
  };

  return successResponse(response, 200, 'Webhook secret regenerated successfully');
}

/**
 * Handle bulk operations
 */
async function handleBulkOperations(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return ErrorResponses.badRequest('Request body is required');
  }

  let body: any;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    return ErrorResponses.badRequest('Invalid JSON in request body');
  }

  const { operation, webhookIds } = body;

  if (!operation || !webhookIds || !Array.isArray(webhookIds)) {
    return ErrorResponses.badRequest('operation and webhookIds are required');
  }

  const validOperations = ['enable', 'disable', 'delete'];
  if (!validOperations.includes(operation)) {
    return ErrorResponses.badRequest(`Operation must be one of: ${validOperations.join(', ')}`);
  }

  let updates: any = {};
  if (operation === 'enable') updates.enabled = true;
  if (operation === 'disable') updates.enabled = false;

  const affectedCount = await bulkUpdateWebhooks(webhookIds, userId, updates);

  const response = {
    operation,
    totalRequested: webhookIds.length,
    succeeded: affectedCount,
    failed: webhookIds.length - affectedCount,
  };

  return successResponse(response, 200, 'Bulk operation completed');
}