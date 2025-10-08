import json
import sys
import os

# Add parent directories to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from shared.models.event import list_events, publish_event
from shared.models.producer import get_producer_by_api_key
from shared.models.schema import get_schema_by_id
from shared.utils.response import success_response, ErrorResponses, cors_preflight_response, paginated_response


def handler(event, context):
    """
    Lambda handler for event admin endpoints
    Requirement 4: Real-time Event Publishing - List Events
    """
    print(f"Event Admin Lambda invoked: {event.get('httpMethod')} {event.get('path')}")

    # Handle CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return cors_preflight_response()

    try:
        http_method = event.get('httpMethod')
        path = event.get('path', '')

        # Route based on method and path
        if http_method == 'GET':
            return handle_list_events(event)
        elif http_method == 'POST' and '/publish' in path:
            return handle_publish_event(event)
        else:
            return ErrorResponses.bad_request('Method not allowed')

    except Exception as error:
        print(f"Error in event admin: {error}")
        import traceback
        traceback.print_exc()
        error_message = str(error) if os.environ.get('NODE_ENV') == 'development' else 'Internal server error'
        return ErrorResponses.internal_server_error(error_message)


def handle_list_events(event):
    """
    Handle list events (admin or producer-scoped)
    GET /api/v1/events
    """
    # Get API key from headers
    headers = event.get('headers', {})
    print(f"DEBUG: All headers received: {headers}")

    # Try different case variations for X-API-Key header
    api_key = (headers.get('X-Api-Key') or
               headers.get('X-API-Key') or
               headers.get('x-api-key') or
               headers.get('X-API-KEY'))

    print(f"DEBUG: Extracted API key: {api_key}")

    if not api_key:
        return ErrorResponses.unauthorized('API key is required')

    # Check if admin (admin API keys start with 'wh_admin')
    is_admin = api_key.startswith('wh_admin')

    producer = None
    if not is_admin:
        producer = get_producer_by_api_key(api_key)
        if not producer:
            return ErrorResponses.unauthorized('Invalid API key')

    # Parse query parameters
    params = event.get('queryStringParameters') or {}
    page = int(params.get('page', '1'))
    limit = int(params.get('limit', '50'))

    # Build filters
    filters = {}

    # If not admin, filter by producer
    if producer:
        filters['producer_id'] = producer['id']

    if params.get('producer_id'):
        filters['producer_id'] = params['producer_id']

    if params.get('schema_id'):
        filters['schema_id'] = params['schema_id']

    if params.get('event_type'):
        filters['event_type'] = params['event_type']

    # Get events
    result = list_events(filters, page, limit)
    events = result['events']
    total = result['total']

    # Transform events to match API response format
    transformed_events = []
    for evt in events:
        transformed_events.append({
            'eventId': evt.get('event_id'),
            'producerId': str(evt.get('producer_id')) if evt.get('producer_id') else None,
            'schemaId': str(evt.get('schema_id')) if evt.get('schema_id') else None,
            'eventType': evt.get('event_type'),
            'payload': evt.get('payload'),
            'subscriberCount': int(evt.get('subscriber_count', 0)),
            'deliveriesQueued': int(evt.get('deliveries_queued', 0)),
            'deliveriesCompleted': int(evt.get('deliveries_completed', 0)),
            'deliveriesFailed': int(evt.get('deliveries_failed', 0)),
            'publishedAt': str(evt.get('published_at')) if evt.get('published_at') else None,
            'createdAt': str(evt.get('created_at')) if evt.get('created_at') else None
        })

    # Create paginated response
    response = paginated_response(transformed_events, total, page, limit)

    # Return success with events key for backward compatibility
    return success_response({**response, 'events': response['data']})


def handle_publish_event(event):
    """
    Handle publish event
    POST /api/v1/events/publish
    """
    # Get API key from headers
    headers = event.get('headers', {})
    api_key = (headers.get('X-Api-Key') or
               headers.get('X-API-Key') or
               headers.get('x-api-key') or
               headers.get('X-API-KEY'))

    if not api_key:
        return ErrorResponses.unauthorized('API key is required')

    # Check if admin (admin can publish test events)
    is_admin = api_key.startswith('wh_admin')

    producer = None
    if not is_admin:
        producer = get_producer_by_api_key(api_key)
        if not producer:
            return ErrorResponses.unauthorized('Invalid API key')

    # Parse request body
    body = event.get('body')
    if not body:
        return ErrorResponses.bad_request('Request body is required')

    try:
        if isinstance(body, str):
            request_body = json.loads(body)
        else:
            request_body = body
    except (json.JSONDecodeError, ValueError):
        return ErrorResponses.bad_request('Invalid JSON in request body')

    print(f"DEBUG: Received request body: {request_body}")

    # Validate required fields
    schema_id = request_body.get('schemaId')
    event_type = request_body.get('eventType')
    payload = request_body.get('payload')

    print(f"DEBUG: schemaId={schema_id}, eventType={event_type}, payload={payload}")

    if not schema_id:
        return ErrorResponses.bad_request('schemaId is required')
    if not event_type:
        return ErrorResponses.bad_request('eventType is required')
    if not payload:
        return ErrorResponses.bad_request('payload is required')

    # Verify schema exists
    schema = get_schema_by_id(schema_id)
    if not schema:
        return ErrorResponses.not_found('Schema not found')

    # For admin test events, use the schema's producer_id
    producer_id = producer['id'] if producer else schema.get('producer_id')

    if not producer_id:
        return ErrorResponses.bad_request('Producer not found for this schema')

    # Publish the event
    try:
        published_event = publish_event(producer_id, schema_id, event_type, payload)
    except Exception as e:
        print(f"Error publishing event: {e}")
        import traceback
        traceback.print_exc()
        return ErrorResponses.internal_server_error(f'Failed to publish event: {str(e)}')

    if not published_event:
        return ErrorResponses.internal_server_error('Failed to publish event')

    # Transform to API response format
    transformed_event = {
        'eventId': published_event.get('event_id'),
        'producerId': str(published_event.get('producer_id')) if published_event.get('producer_id') else None,
        'schemaId': str(published_event.get('schema_id')) if published_event.get('schema_id') else None,
        'eventType': published_event.get('event_type'),
        'payload': published_event.get('payload'),
        'subscriberCount': int(published_event.get('subscriber_count', 0)),
        'deliveriesQueued': int(published_event.get('deliveries_queued', 0)),
        'publishedAt': str(published_event.get('published_at')) if published_event.get('published_at') else None,
        'createdAt': str(published_event.get('created_at')) if published_event.get('created_at') else None
    }

    return success_response({
        'event': transformed_event,
        'message': f'Event published successfully to {published_event.get("subscriber_count", 0)} subscribers'
    })
