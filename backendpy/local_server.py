import os
import sys
import json
from flask import Flask, request, jsonify
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

app = Flask(__name__)

# Enable CORS
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key')
    return response

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'timestamp': str(os.popen('date').read().strip()),
        'environment': os.environ.get('NODE_ENV', 'development')
    })

# Helper function to create Lambda event from Flask request
def create_lambda_event(req, path_params=None):
    return {
        'body': json.dumps(req.get_json()) if req.is_json else req.get_data(as_text=True),
        'headers': dict(req.headers),
        'httpMethod': req.method,
        'path': req.path,
        'pathParameters': path_params or {},
        'queryStringParameters': dict(req.args) if req.args else {},
        'resource': req.path
    }

# Helper function to convert Lambda response to Flask response
def lambda_to_flask_response(lambda_response):
    body = lambda_response.get('body', '')
    status_code = lambda_response.get('statusCode', 200)
    headers = lambda_response.get('headers', {})
    
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except:
            pass
    
    response = jsonify(body) if isinstance(body, dict) else body
    return response, status_code

# Import handlers
from lambdas.producer_onboarding.handler import handler as producer_handler
from lambdas.admin_auth.handler import handler as admin_auth_handler
from lambdas.schema_admin.handler import handler as schema_handler
from lambdas.subscription_admin.handler import handler as subscription_handler
from lambdas.event_admin.handler import handler as event_handler
from lambdas.admin_user_manager.handler import handler as admin_user_handler

# Producer Onboarding Routes
@app.route('/api/v1/producers/onboard', methods=['POST', 'OPTIONS'])
def producer_onboard():
    event = create_lambda_event(request)
    result = producer_handler(event, None)
    return lambda_to_flask_response(result)

# Admin Auth Routes
@app.route('/api/v1/admin/login', methods=['POST', 'OPTIONS'])
def admin_login():
    event = create_lambda_event(request)
    result = admin_auth_handler(event, None)
    return lambda_to_flask_response(result)

# Schema Routes
@app.route('/api/v1/schemas', methods=['GET', 'OPTIONS'])
def list_schemas():
    event = create_lambda_event(request)
    result = schema_handler(event, None)
    return lambda_to_flask_response(result)

# Schema registration route
@app.route('/api/v1/schemas/register', methods=['POST', 'OPTIONS'])
def register_schema():
    event = create_lambda_event(request)
    result = schema_handler(event, None)
    return lambda_to_flask_response(result)

# Get single schema by ID
@app.route('/api/v1/schemas/<schema_id>', methods=['GET', 'OPTIONS'])
def get_schema(schema_id):
    event = create_lambda_event(request, {'schema_id': schema_id})
    result = schema_handler(event, None)
    return lambda_to_flask_response(result)

# Placeholder routes for other schema endpoints
@app.route('/api/v1/schemas/marketplace', methods=['GET', 'OPTIONS'])
@app.route('/api/v1/schemas/<schema_id>/validate', methods=['POST', 'OPTIONS'])
def schemas(*args, **kwargs):
    return jsonify({
        'success': False,
        'error': {
            'code': 'NOT_IMPLEMENTED',
            'message': 'Schema endpoints not yet implemented in Python backend'
        }
    }), 501

# Subscription Routes
@app.route('/api/v1/subscriptions', methods=['GET', 'OPTIONS'])
def list_subscriptions():
    event = create_lambda_event(request)
    result = subscription_handler(event, None)
    return lambda_to_flask_response(result)

# Placeholder routes for other subscription endpoints
@app.route('/api/v1/subscriptions/subscribe', methods=['POST', 'OPTIONS'])
def create_subscription_route():
    from lambdas.subscription_admin.handler import handler as subscription_handler
    event = create_lambda_event(request)
    result = subscription_handler(event, None)
    return lambda_to_flask_response(result)

@app.route('/api/v1/subscriptions/<subscription_id>', methods=['GET', 'PATCH', 'DELETE', 'OPTIONS'])
def subscription_detail(subscription_id):
    from lambdas.subscription_admin.handler import handler as subscription_handler
    event = create_lambda_event(request, {'subscription_id': subscription_id})
    result = subscription_handler(event, None)
    return lambda_to_flask_response(result)

# Event Routes
@app.route('/api/v1/events', methods=['GET', 'OPTIONS'])
def list_events():
    event = create_lambda_event(request)
    result = event_handler(event, None)
    return lambda_to_flask_response(result)

# Event publishing route
@app.route('/api/v1/events/publish', methods=['POST', 'OPTIONS'])
def publish_event():
    event = create_lambda_event(request)
    result = event_handler(event, None)
    return lambda_to_flask_response(result)

# Webhook Listener Route (for testing webhook deliveries)
@app.route('/api/v1/webhook/test', methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
def webhook_listener_route():
    from lambdas.webhook_listener.handler import handler as webhook_listener_handler
    event = create_lambda_event(request)
    result = webhook_listener_handler(event, None)
    return lambda_to_flask_response(result)

# Admin Users Routes
@app.route('/api/v1/admin/users', methods=['GET', 'POST', 'OPTIONS'])
def admin_users_list():
    event = create_lambda_event(request)
    result = admin_user_handler(event, None)
    return lambda_to_flask_response(result)

@app.route('/api/v1/admin/users/<user_id>', methods=['GET', 'PATCH', 'DELETE', 'OPTIONS'])
def admin_users_detail(user_id):
    event = create_lambda_event(request, {'user_id': user_id})
    result = admin_user_handler(event, None)
    return lambda_to_flask_response(result)

@app.route('/api/v1/subscribers', methods=['GET', 'POST', 'OPTIONS'])
def subscribers_route():
    if request.method == 'OPTIONS':
        return '', 204

    if request.method == 'POST':
        from shared.models.subscription import create_subscriber

        # Parse request body
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Request body is required'}), 400

        # Validate required fields
        required_fields = ['name', 'email', 'webhookUrl']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'error': f'{field} is required'}), 400

        # Create subscriber
        try:
            subscriber = create_subscriber(data)
            if not subscriber:
                return jsonify({'success': False, 'error': 'Failed to create subscriber'}), 500

            # Transform to API response format
            response_data = {
                'id': str(subscriber['id']),
                'name': subscriber['name'],
                'company': subscriber.get('company', ''),
                'email': subscriber['email'],
                'apiKey': subscriber.get('api_key_plain'),  # Only time the API key is shown
                'webhookUrl': subscriber['webhook_url'],
                'webhookSecret': subscriber['webhook_secret'],
                'status': subscriber['status'],
                'createdAt': str(subscriber['created_at']) if subscriber.get('created_at') else None
            }

            return jsonify({'success': True, 'subscriber': response_data}), 201

        except Exception as e:
            print(f"Error creating subscriber: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

    # GET request - list subscribers
    from shared.models.subscription import list_subscribers as get_subscribers

    # Parse query parameters
    params = request.args
    page = int(params.get('page', '1'))
    limit = int(params.get('limit', '20'))

    # Build filters
    filters = {}
    if params.get('status'):
        filters['status'] = params['status']
    if params.get('search'):
        filters['search'] = params['search']

    # Get subscribers
    result = get_subscribers(filters, page, limit)
    subscribers = result['subscribers']
    total = result['total']

    # Transform to API response format
    transformed_subscribers = []
    for sub in subscribers:
        transformed_subscribers.append({
            'id': str(sub['id']),
            'name': sub['name'],
            'email': sub['email'],
            'webhookUrl': sub.get('webhook_url'),
            'status': sub['status'],
            'createdAt': str(sub['created_at']) if sub.get('created_at') else None,
            'updatedAt': str(sub['updated_at']) if sub.get('updated_at') else None
        })

    # Calculate pagination
    total_pages = (total + limit - 1) // limit

    return jsonify({
        'success': True,
        'data': transformed_subscribers,
        'subscribers': transformed_subscribers,
        'pagination': {
            'page': page,
            'limit': limit,
            'total': total,
            'totalPages': total_pages
        }
    })

@app.route('/api/v1/subscribers/<subscriber_id>', methods=['PATCH', 'OPTIONS'])
def update_subscriber_route(subscriber_id):
    if request.method == 'OPTIONS':
        return '', 204

    from shared.models.subscription import update_subscriber

    # Parse request body
    try:
        data = request.get_json()
    except:
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_JSON',
                'message': 'Invalid JSON in request body'
            }
        }), 400

    # Update subscriber
    subscriber = update_subscriber(subscriber_id, data)

    if not subscriber:
        return jsonify({
            'success': False,
            'error': {
                'code': 'NOT_FOUND',
                'message': 'Subscriber not found'
            }
        }), 404

    # Transform to API response format
    transformed_subscriber = {
        'id': str(subscriber['id']),
        'name': subscriber['name'],
        'email': subscriber['email'],
        'webhookUrl': subscriber.get('webhook_url'),
        'status': subscriber['status'],
        'createdAt': str(subscriber['created_at']) if subscriber.get('created_at') else None,
        'updatedAt': str(subscriber['updated_at']) if subscriber.get('updated_at') else None
    }

    return jsonify({
        'success': True,
        'subscriber': transformed_subscriber,
        'message': 'Subscriber updated successfully'
    })

@app.route('/api/v1/admin/schemas/<schema_id>', methods=['PATCH', 'OPTIONS'])
def admin_update_schema(schema_id):
    event = create_lambda_event(request, {'schema_id': schema_id})
    result = schema_handler(event, None)
    return lambda_to_flask_response(result)

@app.route('/api/v1/deliveries/stats', methods=['GET', 'OPTIONS'])
def delivery_stats():
    return jsonify({
        'success': True,
        'data': {
            'total': 0,
            'success': 0,
            'failed': 0,
            'retrying': 0,
            'pending': 0,
            'successRate': 0,
            'avgLatencyMs': 0
        }
    })

@app.route('/api/v1/admin/dlq', methods=['GET', 'OPTIONS'])
def admin_dlq():
    return jsonify({
        'success': True,
        'data': {
            'entries': [],
            'total': 0
        }
    })

if __name__ == '__main__':
    PORT = int(os.environ.get('API_PORT', 3005))
    
    print('=' * 70)
    print('Python Webhook Management System - Local Development Server')
    print('=' * 70)
    print(f'Server running on http://localhost:{PORT}')
    print(f'PostgreSQL: {os.environ.get("DATABASE_HOST")}:{os.environ.get("DATABASE_PORT")}')
    print('')
    print('Available endpoints:')
    print('   POST   /api/v1/producers/onboard')
    print('   POST   /api/v1/admin/login')
    print('   GET    /api/v1/schemas')
    print('   POST   /api/v1/schemas/register')
    print('   GET    /api/v1/subscriptions')
    print('   POST   /api/v1/subscriptions/subscribe')
    print('   GET    /api/v1/events')
    print('   POST   /api/v1/events/publish')
    print('   ALL    /api/v1/webhook/test  (test webhook endpoint)')
    print('   GET    /health')
    print('')
    print('Note: Other endpoints return 501 Not Implemented')
    print('')
    print('Ready to accept requests!')
    print('=' * 70)
    
    app.run(host='0.0.0.0', port=PORT, debug=True)
