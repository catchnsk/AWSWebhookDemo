import json
import sys
import os

# Add parent directories to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from shared.models.subscription import list_subscriptions, get_subscriber_by_api_key, create_subscription
from shared.models.schema import get_schema_by_id
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
        path = event.get('path', '')

        # Route based on method and path
        if http_method == 'POST' and '/subscribe' in path:
            return handle_create_subscription(event)
        elif http_method == 'GET':
            return handle_list_subscriptions(event)
        else:
            return ErrorResponses.bad_request('Method not allowed')

    except Exception as error:
        print(f"Error in subscription admin: {error}")
        import traceback
        traceback.print_exc()
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


def handle_create_subscription(event):
    """
    Handle create subscription
    POST /api/v1/subscriptions/subscribe
    """
    # Get API key from headers
    headers = event.get('headers', {})
    api_key = (headers.get('X-Api-Key') or
               headers.get('X-API-Key') or
               headers.get('x-api-key') or
               headers.get('X-API-KEY'))

    if not api_key:
        return ErrorResponses.unauthorized('API key is required')

    # Check if admin (admin API keys start with 'wh_admin')
    is_admin = api_key.startswith('wh_admin')

    # Get subscriber - either from API key (for subscribers) or from request body (for admins)
    subscriber = None
    if not is_admin:
        subscriber = get_subscriber_by_api_key(api_key)
        if not subscriber:
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

    # Validate required fields
    schema_id = request_body.get('schemaId')
    if not schema_id:
        return ErrorResponses.bad_request('schemaId is required')

    # For admin requests, get subscriberId from request body
    if is_admin:
        subscriber_id = request_body.get('subscriberId')
        if not subscriber_id:
            return ErrorResponses.bad_request('subscriberId is required for admin requests')

        # Get subscriber by ID
        from shared.models.subscription import get_subscriber_by_id
        subscriber = get_subscriber_by_id(subscriber_id)
        if not subscriber:
            return ErrorResponses.not_found('Subscriber not found')

    # Verify schema exists
    schema = get_schema_by_id(schema_id)
    if not schema:
        return ErrorResponses.not_found('Schema not found')

    # Check if schema is public or requires approval
    if not schema.get('is_public') and schema.get('requires_approval'):
        # In a full implementation, would check approval_status
        pass

    # Get webhook URL - use provided or default to subscriber's webhook URL
    webhook_url = request_body.get('webhookUrl', subscriber.get('webhook_url'))
    if not webhook_url:
        return ErrorResponses.bad_request('webhookUrl is required')

    # Prepare subscription data
    subscription_data = {
        'subscriber_id': subscriber['id'],
        'schema_id': schema_id,
        'webhook_url': webhook_url,
        'webhook_secret': subscriber.get('webhook_secret', ''),
        'max_retries': request_body.get('maxRetries', 3),
        'backoff_strategy': request_body.get('backoffStrategy', 'exponential'),
        'enabled': True,
        'auth_type': 'hmac',
        'status': 'active'
    }

    # Create subscription
    try:
        subscription = create_subscription(subscription_data)
    except Exception as e:
        print(f"Error creating subscription: {e}")
        # Check if it's a unique constraint violation
        if 'unique' in str(e).lower() or 'duplicate' in str(e).lower():
            return ErrorResponses.bad_request('Subscription already exists for this schema')
        raise

    if not subscription:
        return ErrorResponses.internal_server_error('Failed to create subscription')

    # Transform to API response format
    transformed_subscription = {
        'id': str(subscription['id']),
        'subscriberId': str(subscription['subscriber_id']),
        'schemaId': str(subscription['schema_id']),
        'webhookUrl': subscription['webhook_url'],
        'maxRetries': int(subscription['max_retries']),
        'backoffStrategy': subscription['backoff_strategy'],
        'enabled': subscription['enabled'],
        'status': subscription['status'],
        'createdAt': str(subscription['created_at']) if subscription.get('created_at') else None,
        'schema': {
            'id': str(schema['id']),
            'name': schema['name'],
            'eventType': schema['event_type'],
            'version': schema['version']
        }
    }

    return success_response({
        'subscription': transformed_subscription,
        'message': 'Subscription created successfully'
    })
