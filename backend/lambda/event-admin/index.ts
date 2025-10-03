import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { listEventMessages } from '../../shared/models/eventMessage';
import { successResponse, ErrorResponses, corsPreflightResponse } from '../../shared/utils/response';
import { initializeDatabase } from '../../shared/utils/database';

/**
 * Lambda handler for event admin operations
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Event Admin Lambda invoked', {
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

    // Only allow GET requests for listing events
    if (event.httpMethod !== 'GET') {
      return ErrorResponses.badRequest('Method not allowed');
    }

    return await handleListEvents(event);
  } catch (error: any) {
    console.error('Error in event admin:', error);
    return ErrorResponses.internalServerError(
      process.env.NODE_ENV === 'development' ? error.message : 'Operation failed'
    );
  }
}

/**
 * Handle list events
 */
async function handleListEvents(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const page = parseInt(params.page || '1', 10);
  const limit = parseInt(params.limit || '50', 10);

  const filters: any = {};

  if (params.producer_id) filters.producer_id = params.producer_id;
  if (params.schema_id) filters.schema_id = params.schema_id;
  if (params.event_type) filters.event_type = params.event_type;

  const { events, total } = await listEventMessages(filters, page, limit);

  const transformedEvents = events.map((event) => ({
    eventId: event.event_id,
    producerId: event.producer_id,
    schemaId: event.schema_id,
    eventType: event.event_type,
    payload: event.payload,
    subscriberCount: event.subscriber_count,
    deliveriesQueued: event.deliveries_queued,
    deliveriesCompleted: event.deliveries_completed,
    deliveriesFailed: event.deliveries_failed,
    publishedAt: event.published_at,
    createdAt: event.created_at,
  }));

  return successResponse({
    events: transformedEvents,
    total,
    page,
    limit,
  });
}
