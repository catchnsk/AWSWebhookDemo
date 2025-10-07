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

# Placeholder routes for other schema endpoints
@app.route('/api/v1/schemas/marketplace', methods=['GET', 'OPTIONS'])
@app.route('/api/v1/schemas/<schema_id>', methods=['GET', 'OPTIONS'])
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
@app.route('/api/v1/subscriptions/<subscription_id>', methods=['GET', 'PATCH', 'DELETE', 'OPTIONS'])
def subscriptions(*args, **kwargs):
    return jsonify({
        'success': False,
        'error': {
            'code': 'NOT_IMPLEMENTED',
            'message': 'Subscription endpoints not yet implemented in Python backend'
        }
    }), 501

# Event Routes
@app.route('/api/v1/events', methods=['GET', 'OPTIONS'])
def list_events():
    event = create_lambda_event(request)
    result = event_handler(event, None)
    return lambda_to_flask_response(result)

# Placeholder route for event publishing
@app.route('/api/v1/events/publish', methods=['POST', 'OPTIONS'])
def publish_event():
    return jsonify({
        'success': False,
        'error': {
            'code': 'NOT_IMPLEMENTED',
            'message': 'Event publishing endpoint not yet implemented in Python backend'
        }
    }), 501

@app.route('/api/v1/admin/users', methods=['GET', 'POST', 'OPTIONS'])
@app.route('/api/v1/admin/users/<user_id>', methods=['GET', 'PATCH', 'DELETE', 'OPTIONS'])
def admin_users(*args, **kwargs):
    return jsonify({
        'success': False,
        'error': {
            'code': 'NOT_IMPLEMENTED',
            'message': 'Admin user endpoints not yet implemented in Python backend'
        }
    }), 501

@app.route('/api/v1/subscribers', methods=['GET', 'OPTIONS'])
@app.route('/api/v1/subscribers/<subscriber_id>', methods=['PATCH', 'OPTIONS'])
def subscribers(*args, **kwargs):
    return jsonify({
        'success': False,
        'error': {
            'code': 'NOT_IMPLEMENTED',
            'message': 'Subscriber endpoints not yet implemented in Python backend'
        }
    }), 501

@app.route('/api/v1/admin/schemas/<schema_id>', methods=['PATCH', 'OPTIONS'])
def admin_schemas(*args, **kwargs):
    return jsonify({
        'success': False,
        'error': {
            'code': 'NOT_IMPLEMENTED',
            'message': 'Admin schema endpoints not yet implemented in Python backend'
        }
    }), 501

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
    print('   GET    /api/v1/events')
    print('   GET    /health')
    print('')
    print('Note: Other endpoints return 501 Not Implemented')
    print('')
    print('Ready to accept requests!')
    print('=' * 70)
    
    app.run(host='0.0.0.0', port=PORT, debug=True)
