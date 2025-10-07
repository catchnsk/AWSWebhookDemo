import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Import Lambda handlers
from lambda.admin_auth import handle_login
from lambda.admin_user_manager import (
    handle_create_admin,
    handle_list_admins,
    handle_get_admin,
    handle_update_admin,
    handle_delete_admin
)
from shared.utils.database import query, query_one

# ============================================================================
# Admin Auth Routes
# ============================================================================

@app.route('/api/v1/admin/login', methods=['POST', 'OPTIONS'])
def admin_login():
    if request.method == 'OPTIONS':
        return '', 200
    return handle_login(request.json)

# ============================================================================
# Admin User Manager Routes
# ============================================================================

@app.route('/api/v1/admin/users', methods=['POST', 'GET', 'OPTIONS'])
def admin_users():
    if request.method == 'OPTIONS':
        return '', 200
    if request.method == 'POST':
        return handle_create_admin(request.json)
    return handle_list_admins(request.args)

@app.route('/api/v1/admin/users/<user_id>', methods=['GET', 'PATCH', 'DELETE', 'OPTIONS'])
def admin_user(user_id):
    if request.method == 'OPTIONS':
        return '', 200
    if request.method == 'GET':
        return handle_get_admin(user_id)
    if request.method == 'PATCH':
        return handle_update_admin(user_id, request.json)
    if request.method == 'DELETE':
        return handle_delete_admin(user_id)

# ============================================================================
# Producer Routes
# ============================================================================

@app.route('/api/v1/producers/onboard', methods=['POST', 'OPTIONS'])
def producer_onboard():
    if request.method == 'OPTIONS':
        return '', 200
    # Placeholder - implement producer onboarding logic
    return jsonify({'success': True, 'message': 'Producer onboarding not yet implemented'}), 200

# ============================================================================
# Schema Routes
# ============================================================================

@app.route('/api/v1/schemas/register', methods=['POST', 'OPTIONS'])
def schema_register():
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({'success': True, 'message': 'Schema registration not yet implemented'}), 200

@app.route('/api/v1/schemas', methods=['GET', 'OPTIONS'])
def schemas_list():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        offset = (page - 1) * limit

        count_result = query_one("SELECT COUNT(*) as total FROM schemas")
        total = count_result['total'] if count_result else 0

        schemas = query(
            "SELECT * FROM schemas ORDER BY created_at DESC LIMIT %s OFFSET %s",
            (limit, offset)
        )

        return jsonify({
            'success': True,
            'data': {
                'schemas': [dict(s) for s in schemas] if schemas else [],
                'pagination': {'total': total, 'page': page, 'limit': limit}
            }
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/v1/schemas/marketplace', methods=['GET', 'OPTIONS'])
def schemas_marketplace():
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({'success': True, 'schemas': [], 'total': 0}), 200

@app.route('/api/v1/schemas/<schema_id>', methods=['GET', 'OPTIONS'])
def schema_get(schema_id):
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({'success': True, 'message': 'Schema get not yet implemented'}), 200

@app.route('/api/v1/schemas/<schema_id>/validate', methods=['POST', 'OPTIONS'])
def schema_validate(schema_id):
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({'success': True, 'valid': True, 'errors': []}), 200

@app.route('/api/v1/admin/schemas/<schema_id>', methods=['PATCH', 'OPTIONS'])
def admin_schema_update(schema_id):
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({'success': True, 'message': 'Schema update not yet implemented'}), 200

# ============================================================================
# Subscriber Routes
# ============================================================================

@app.route('/api/v1/subscribers', methods=['GET', 'OPTIONS'])
def subscribers_list():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        subscribers = query(
            "SELECT id, name, email, webhook_url, status, created_at FROM subscribers ORDER BY created_at DESC"
        )
        return jsonify({
            'success': True,
            'subscribers': [dict(s) for s in subscribers] if subscribers else []
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/subscribers/<subscriber_id>', methods=['PATCH', 'OPTIONS'])
def subscriber_update(subscriber_id):
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.json
        updates = []
        params = []

        if 'name' in data:
            updates.append("name = %s")
            params.append(data['name'])
        if 'email' in data:
            updates.append("email = %s")
            params.append(data['email'])
        if 'webhookUrl' in data:
            updates.append("webhook_url = %s")
            params.append(data['webhookUrl'])
        if 'status' in data:
            updates.append("status = %s")
            params.append(data['status'])

        if not updates:
            return jsonify({'error': {'message': 'No fields to update'}}), 400

        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(subscriber_id)

        sql = f"""
            UPDATE subscribers
            SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, name, email, webhook_url, status, created_at, updated_at
        """

        result = query_one(sql, params)
        if not result:
            return jsonify({'error': {'message': 'Subscriber not found'}}), 404

        return jsonify({'success': True, 'subscriber': dict(result)}), 200
    except Exception as e:
        return jsonify({'error': {'message': str(e)}}), 500

# ============================================================================
# Subscription Routes
# ============================================================================

@app.route('/api/v1/subscriptions/subscribe', methods=['POST', 'OPTIONS'])
def subscription_subscribe():
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({'success': True, 'message': 'Subscription not yet implemented'}), 200

@app.route('/api/v1/subscriptions', methods=['GET', 'OPTIONS'])
def subscriptions_list():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        offset = (page - 1) * limit

        count_result = query_one("SELECT COUNT(*) as total FROM subscriptions")
        total = count_result['total'] if count_result else 0

        subscriptions = query(
            "SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT %s OFFSET %s",
            (limit, offset)
        )

        return jsonify({
            'success': True,
            'data': {
                'subscriptions': [dict(s) for s in subscriptions] if subscriptions else [],
                'pagination': {'total': total, 'page': page, 'limit': limit}
            }
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/v1/subscriptions/<subscription_id>', methods=['GET', 'PATCH', 'DELETE', 'OPTIONS'])
def subscription_detail(subscription_id):
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({'success': True, 'message': 'Subscription detail not yet implemented'}), 200

# ============================================================================
# Event Routes
# ============================================================================

@app.route('/api/v1/events/publish', methods=['POST', 'OPTIONS'])
def event_publish():
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({'success': True, 'message': 'Event publish not yet implemented'}), 200

@app.route('/api/v1/events', methods=['GET', 'OPTIONS'])
def events_list():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        offset = (page - 1) * limit

        count_result = query_one("SELECT COUNT(*) as total FROM event_messages")
        total = count_result['total'] if count_result else 0

        events = query(
            "SELECT * FROM event_messages ORDER BY created_at DESC LIMIT %s OFFSET %s",
            (limit, offset)
        )

        return jsonify({
            'success': True,
            'data': {
                'events': [dict(e) for e in events] if events else [],
                'total': total
            }
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# Delivery Routes
# ============================================================================

@app.route('/api/v1/deliveries/stats', methods=['GET', 'OPTIONS'])
def delivery_stats():
    if request.method == 'OPTIONS':
        return '', 200
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
    }), 200

# ============================================================================
# DLQ Routes
# ============================================================================

@app.route('/api/v1/admin/dlq', methods=['GET', 'OPTIONS'])
def dlq_list():
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({'success': True, 'data': {'entries': [], 'total': 0}}), 200

# ============================================================================
# Health Check
# ============================================================================

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'environment': os.getenv('NODE_ENV', 'development'),
    }), 200

# ============================================================================
# Start Server
# ============================================================================

if __name__ == '__main__':
    PORT = int(os.getenv('API_PORT', 3002))
    print('🚀 Webhook Management System - Python Backend')
    print('=' * 50)
    print(f'📡 Server running on http://localhost:{PORT}')
    print(f'🗄️  PostgreSQL: {os.getenv("DATABASE_HOST")}:{os.getenv("DATABASE_PORT")}')
    print(f'📨 Kafka: {os.getenv("KAFKA_BROKERS")}')
    print('')
    print('📚 Available endpoints:')
    print('   POST   /api/v1/admin/login')
    print('   POST   /api/v1/admin/users')
    print('   GET    /api/v1/admin/users')
    print('   POST   /api/v1/producers/onboard')
    print('   POST   /api/v1/schemas/register')
    print('   GET    /api/v1/schemas')
    print('   GET    /api/v1/subscriptions')
    print('   POST   /api/v1/events/publish')
    print('   GET    /health')
    print('')
    print('🎉 Ready to accept requests!')
    print('')
    app.run(host='0.0.0.0', port=PORT, debug=True)
