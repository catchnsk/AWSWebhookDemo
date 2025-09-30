import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createWebhook } from '../../shared/models/webhook';
import { successResponse, errorResponse, ErrorResponses, corsPreflightResponse } from '../../shared/utils/response';
import { validateWebhookConfig, isValidUrl } from '../../shared/utils/validation';
import { generateWebhookSecret } from '../../shared/utils/crypto';
import { initializeDatabase } from '../../shared/utils/database';

/**
 * Lambda handler for webhook registration
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Webhook Register Lambda invoked', {
    httpMethod: event.httpMethod,
    path: event.path,
  });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    // Initialize database connection
    await initializeDatabase();

    // Extract user ID from authorizer context (set by API Gateway authorizer)
    const userId = event.requestContext.authorizer?.principalId || event.requestContext.authorizer?.claims?.sub;

    if (!userId) {
      return ErrorResponses.unauthorized('User authentication required');
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

    // Validate webhook configuration
    const validation = validateWebhookConfig(requestBody);
    if (!validation.valid) {
      return ErrorResponses.badRequest('Webhook validation failed', validation.errors);
    }

    // Validate schema ID if provided
    if (requestBody.schemaId) {
      // TODO: Verify schema exists
      // For now, we'll skip this check in the MVP
    }

    // Generate webhook secret
    const webhookSecret = generateWebhookSecret();

    // Prepare webhook data
    const webhookData = {
      user_id: userId,
      name: requestBody.name,
      description: requestBody.description,
      url: requestBody.url,
      event_type: requestBody.eventType,
      schema_id: requestBody.schemaId,
      enabled: requestBody.enabled !== false,
      auth_type: requestBody.authentication?.type || 'none',
      auth_config: requestBody.authentication ? {
        token: requestBody.authentication.token,
        username: requestBody.authentication.username,
      } : null,
      max_retries: requestBody.retryPolicy?.maxRetries ?? 3,
      backoff_strategy: requestBody.retryPolicy?.backoffStrategy || 'exponential',
      initial_delay_ms: requestBody.retryPolicy?.initialDelayMs ?? 1000,
      timeout_ms: requestBody.timeoutMs ?? 30000,
      custom_headers: requestBody.headers,
      tags: requestBody.tags || [],
      secret: webhookSecret,
    };

    // Check for duplicate webhook name
    try {
      const webhook = await createWebhook(webhookData);

      // Prepare response (exclude sensitive data)
      const response = {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        description: webhook.description,
        eventType: webhook.event_type,
        schemaId: webhook.schema_id,
        authentication: {
          type: webhook.auth_type,
        },
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
        createdAt: webhook.created_at,
        updatedAt: webhook.updated_at,
      };

      return successResponse(response, 201, 'Webhook registered successfully');
    } catch (error: any) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return ErrorResponses.conflict('A webhook with this name already exists');
      }

      throw error;
    }
  } catch (error: any) {
    console.error('Error in webhook registration:', error);
    return ErrorResponses.internalServerError(
      process.env.NODE_ENV === 'development' ? error.message : 'Failed to register webhook'
    );
  }
}

/**
 * Validate authentication configuration
 */
function validateAuthentication(auth: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!auth) {
    return { valid: true, errors };
  }

  const validTypes = ['bearer', 'api_key', 'oauth2', 'basic', 'none'];
  if (!validTypes.includes(auth.type)) {
    errors.push(`Authentication type must be one of: ${validTypes.join(', ')}`);
  }

  if (auth.type === 'bearer' && !auth.token) {
    errors.push('Bearer token is required for bearer authentication');
  }

  if (auth.type === 'api_key' && !auth.token) {
    errors.push('API key is required for api_key authentication');
  }

  if (auth.type === 'basic' && (!auth.username || !auth.token)) {
    errors.push('Username and password are required for basic authentication');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}