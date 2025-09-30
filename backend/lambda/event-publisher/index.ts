import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getProducerByApiKey, incrementEventPublishedCount } from '../../shared/models/producer';
import { getSchemaByEventType, incrementSchemaEventCount } from '../../shared/models/schema';
import { createEventMessage, updateEventMessageDeliveryCounts } from '../../shared/models/eventMessage';
import { listActiveSubscriptionsForSchema } from '../../shared/models/subscription';
import { createDeliveryLog } from '../../shared/models/deliveryLog';
import { validateAgainstSchema } from '../../shared/utils/schemaRegistry';
import { publishMessage } from '../../shared/utils/kafka';
import { successResponse, ErrorResponses, corsPreflightResponse } from '../../shared/utils/response';
import { initializeDatabase } from '../../shared/utils/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Lambda handler for event publishing
 *
 * Requirement 5: Internal Systems will post an event message
 * - 5a: Fetch event and subscription details from Webhook database
 * - 5b: Get the schema from Schema Registry to validate the payload
 * - 5c: Produce the message to send to Delivery message store
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Event Publisher Lambda invoked', {
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

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
      return ErrorResponses.badRequest('Method not allowed');
    }

    // Extract API key from Authorization header
    const apiKey = event.headers['Authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      return ErrorResponses.unauthorized('API key is required');
    }

    // Validate producer
    const producer = await getProducerByApiKey(apiKey);

    if (!producer) {
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

    // Validate event publishing request
    const validation = validateEventPublishRequest(requestBody);
    if (!validation.valid) {
      return ErrorResponses.badRequest('Validation failed', validation.errors);
    }

    // Step 1: Fetch schema by event type
    console.log('Fetching schema for event type:', requestBody.eventType);
    const schema = await getSchemaByEventType(requestBody.eventType, requestBody.version);

    if (!schema) {
      return ErrorResponses.notFound('Schema', `eventType: ${requestBody.eventType}`);
    }

    // Verify producer owns this schema
    if (schema.producer_id !== producer.id) {
      return ErrorResponses.forbidden('You do not have permission to publish events for this schema');
    }

    // Step 2: Validate payload against schema from Schema Registry
    console.log('Validating payload against schema...');
    const schemaValidation = await validateAgainstSchema(
      schema.name,
      requestBody.payload,
      schema.schema_registry_version
    );

    if (!schemaValidation.valid) {
      return ErrorResponses.unprocessableEntity(
        'Payload validation failed',
        schemaValidation.errors
      );
    }

    console.log('Payload validation successful');

    // Step 3: Fetch all active subscriptions for this schema
    console.log('Fetching active subscriptions...');
    const subscriptions = await listActiveSubscriptionsForSchema(schema.id);

    console.log(`Found ${subscriptions.length} active subscriptions`);

    if (subscriptions.length === 0) {
      return successResponse({
        message: 'Event validated but no active subscriptions found',
        eventType: requestBody.eventType,
        subscriptionCount: 0,
      });
    }

    // Step 4: Create event message record
    console.log('Creating event message record...');
    const eventMessage = await createEventMessage({
      producer_id: producer.id,
      schema_id: schema.id,
      event_type: requestBody.eventType,
      payload: requestBody.payload,
      correlation_id: requestBody.correlationId,
      idempotency_key: requestBody.idempotencyKey,
    });

    console.log('Event message created:', eventMessage.event_id);

    // Step 5: Publish to Kafka delivery-messages topic for each subscription
    console.log('Publishing to Kafka delivery-messages topic...');
    const deliveryPromises = subscriptions.map(async (subscription) => {
      const deliveryId = `dlv_${uuidv4().replace(/-/g, '')}`;

      // Create delivery message for Kafka
      const deliveryMessage = {
        deliveryId,
        eventId: eventMessage.event_id,
        subscriptionId: subscription.id,
        subscriberId: subscription.subscriber_id,
        webhookUrl: subscription.webhook_url,
        webhookSecret: subscription.webhook_secret,
        authType: subscription.auth_type,
        authConfig: subscription.auth_config,
        customHeaders: subscription.custom_headers,
        payload: requestBody.payload,
        retryAttempt: 0,
        maxRetries: subscription.max_retries,
        backoffStrategy: subscription.backoff_strategy,
        initialDelayMs: subscription.initial_delay_ms,
        timeoutMs: subscription.timeout_ms,
        timestamp: new Date().toISOString(),
      };

      // Publish to Kafka
      await publishMessage(
        process.env.KAFKA_TOPIC_EVENTS || 'delivery-messages',
        deliveryMessage,
        deliveryId
      );

      // Create delivery log record in database
      await createDeliveryLog({
        event_id: eventMessage.event_id,
        subscription_id: subscription.id,
        subscriber_id: subscription.subscriber_id,
        request_url: subscription.webhook_url,
        request_method: 'POST',
        request_payload: requestBody.payload,
        status: 'queued',
        retry_attempt: 0,
      });

      console.log(`Delivery queued for subscription ${subscription.id}`);
    });

    // Wait for all deliveries to be queued
    await Promise.all(deliveryPromises);

    // Update event message with delivery counts
    await updateEventMessageDeliveryCounts(eventMessage.event_id, {
      subscriber_count: subscriptions.length,
      deliveries_queued: subscriptions.length,
    });

    // Increment producer and schema counters
    await Promise.all([
      incrementEventPublishedCount(producer.id),
      incrementSchemaEventCount(schema.id),
    ]);

    console.log('Event published successfully to all subscriptions');

    // Prepare response
    const response = {
      eventId: eventMessage.event_id,
      eventType: requestBody.eventType,
      subscriberCount: subscriptions.length,
      deliveriesQueued: subscriptions.length,
      publishedAt: eventMessage.published_at,
      message: 'Event published successfully and queued for delivery to all subscribers',
    };

    return successResponse(response, 202); // 202 Accepted (async processing)
  } catch (error: any) {
    console.error('Error publishing event:', error);
    return ErrorResponses.internalServerError(
      process.env.NODE_ENV === 'development' ? error.message : 'Failed to publish event'
    );
  }
}

/**
 * Validate event publishing request
 */
function validateEventPublishRequest(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.eventType || typeof data.eventType !== 'string') {
    errors.push('eventType is required and must be a string');
  }

  if (!data.payload || typeof data.payload !== 'object') {
    errors.push('payload is required and must be an object');
  }

  if (data.version !== undefined && typeof data.version !== 'string') {
    errors.push('version must be a string');
  }

  if (data.correlationId !== undefined && typeof data.correlationId !== 'string') {
    errors.push('correlationId must be a string');
  }

  if (data.idempotencyKey !== undefined && typeof data.idempotencyKey !== 'string') {
    errors.push('idempotencyKey must be a string');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}