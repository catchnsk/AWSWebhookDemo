import json
import sys
import os

# Add parent directories to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from shared.models.subscription import list_subscriptions, get_subscriber_by_api_key
from shared.utils.response import success_response, ErrorResponses, cors_preflight_response, paginated_response


def handler(event, context):
    """
    Lambda handler for subscription admin endpoints
    Requirement 3: Partner subscribes to a schema via API Exchange
    """
    print(f"Subscription Admin Lambda invoked: {event.get('httpMethod')} {event.get('path')}")

    # Handle CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return cors_preflight_response()

    try:
        http_method = event.get('httpMethod')

        # Route based on method
        if http_method == 'GET':
            return handle_list_subscriptions(event)
        else:
            return ErrorResponses.bad_request('Method not allowed')

    except Exception as error:
        print(f"Error in subscription admin: {error}")
        error_message = str(error) if os.environ.get('NODE_ENV') == 'development' else 'Internal server error'
        return ErrorResponses.internal_server_error(error_message)


def handle_list_subscriptions(event):
    """
    Handle list subscriptions (admin or subscriber-scoped)
    GET /api/v1/subscriptions
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

    subscriber = None
    if not is_admin:
        subscriber = get_subscriber_by_api_key(api_key)
        if not subscriber:
            return ErrorResponses.unauthorized('Invalid API key')

    # Parse query parameters
    params = event.get('queryStringParameters') or {}
    page = int(params.get('page', '1'))
    limit = int(params.get('limit', '20'))

    # Build filters
    filters = {}

    # If not admin, filter by subscriber
    if subscriber:
        filters['subscriber_id'] = subscriber['id']

    if params.get('status'):
        filters['status'] = params['status']

    if params.get('enabled'):
        filters['enabled'] = params['enabled'] == 'true'

    # Get subscriptions
    result = list_subscriptions(filters, page, limit)
    subscriptions = result['subscriptions']
    total = result['total']

    # Transform subscriptions to match API response format
    transformed_subscriptions = []
    for sub in subscriptions:
        # Calculate success rate
        total_deliveries = int(sub.get('total_deliveries', 0))
        successful_deliveries = int(sub.get('successful_deliveries', 0))
        failed_deliveries = int(sub.get('failed_deliveries', 0))
        success_rate = 0
        if total_deliveries > 0:
            success_rate = round((successful_deliveries / total_deliveries) * 100, 2)

        transformed_subscriptions.append({
            'id': str(sub['id']),
            'subscriberId': str(sub['subscriber_id']),
            'schemaId': str(sub['schema_id']),
            'webhookUrl': sub['webhook_url'],
            'maxRetries': int(sub['max_retries']),
            'backoffStrategy': sub['backoff_strategy'],
            'enabled': sub['enabled'],
            'status': sub['status'],
            'schema': {
                'id': str(sub.get('schema_pk_id')) if sub.get('schema_pk_id') else None,
                'name': sub.get('schema_name'),
                'eventType': sub.get('schema_event_type'),
                'version': sub.get('schema_version')
            },
            'statistics': {
                'totalDeliveries': total_deliveries,
                'successfulDeliveries': successful_deliveries,
                'failedDeliveries': failed_deliveries,
                'successRate': success_rate
            },
            'createdAt': str(sub['created_at']) if sub.get('created_at') else None
        })

    # Create paginated response
    response = paginated_response(transformed_subscriptions, total, page, limit)

    # Return success with subscriptions key for backward compatibility
    return success_response({**response, 'subscriptions': response['data']})
