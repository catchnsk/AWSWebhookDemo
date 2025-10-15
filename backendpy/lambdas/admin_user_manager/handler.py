import json
import sys
import os

# Add parent directories to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from shared.utils.response import success_response, ErrorResponses, cors_preflight_response, paginated_response
from shared.utils.database import query, query_one


def handler(event, context):
    """
    Lambda handler for admin user management endpoints
    """
    print(f"Admin User Manager Lambda invoked: {event.get('httpMethod')} {event.get('path')}")

    # Handle CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return cors_preflight_response()

    try:
        http_method = event.get('httpMethod')
        path = event.get('path', '')
        path_parameters = event.get('pathParameters') or {}

        # Route based on method and path
        if http_method == 'GET' and not path_parameters.get('user_id'):
            return handle_list_users(event)
        elif http_method == 'GET' and path_parameters.get('user_id'):
            return handle_get_user(event)
        elif http_method == 'POST':
            return handle_create_user(event)
        elif http_method == 'PATCH':
            return handle_update_user(event)
        elif http_method == 'DELETE':
            return handle_delete_user(event)
        else:
            return ErrorResponses.bad_request('Method not allowed')

    except Exception as error:
        print(f"Error in admin user manager: {error}")
        import traceback
        traceback.print_exc()
        error_message = str(error) if os.environ.get('NODE_ENV') == 'development' else 'Internal server error'
        return ErrorResponses.internal_server_error(error_message)


def handle_list_users(event):
    """
    Handle list admin users
    GET /api/v1/admin/users
    """
    # Get API key from headers - only admins can access
    headers = event.get('headers', {})
    api_key = (headers.get('X-Api-Key') or
               headers.get('X-API-Key') or
               headers.get('x-api-key'))

    if not api_key or not api_key.startswith('wh_admin'):
        return ErrorResponses.unauthorized('Admin access required')

    # Parse query parameters
    params = event.get('queryStringParameters') or {}
    page = int(params.get('page', '1'))
    limit = int(params.get('limit', '20'))
    offset = (page - 1) * limit

    # Build query
    conditions = []
    query_params = []

    if params.get('status'):
        conditions.append("status = %s")
        query_params.append(params['status'])

    if params.get('role'):
        conditions.append("role = %s")
        query_params.append(params['role'])

    if params.get('search'):
        conditions.append("(name ILIKE %s OR email ILIKE %s)")
        search_term = f"%{params['search']}%"
        query_params.extend([search_term, search_term])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Get total count
    count_sql = f"SELECT COUNT(*) as total FROM admins {where_clause}"
    total_result = query_one(count_sql, tuple(query_params))
    total = total_result['total'] if total_result else 0

    # Get paginated results
    users_sql = f"""
        SELECT id, name, email, role, status, last_login_at, created_at, updated_at
        FROM admins
        {where_clause}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
    """
    query_params.extend([limit, offset])
    users = query(users_sql, tuple(query_params))

    # Transform to API format
    transformed_users = []
    for user in users:
        transformed_users.append({
            'id': str(user['id']),
            'name': user['name'],
            'email': user['email'],
            'role': user['role'],
            'status': user['status'],
            'lastLoginAt': str(user['last_login_at']) if user.get('last_login_at') else None,
            'createdAt': str(user['created_at']) if user.get('created_at') else None,
            'updatedAt': str(user['updated_at']) if user.get('updated_at') else None,
        })

    # Create paginated response
    response = paginated_response(transformed_users, total, page, limit)

    return success_response({**response, 'admins': response['data']})


def handle_get_user(event):
    """
    Handle get single admin user
    GET /api/v1/admin/users/{user_id}
    """
    return ErrorResponses.not_found('Not implemented')


def handle_create_user(event):
    """
    Handle create admin user
    POST /api/v1/admin/users
    """
    import bcrypt
    import uuid

    # Get API key from headers - only admins can access
    headers = event.get('headers', {})
    api_key = (headers.get('X-Api-Key') or
               headers.get('X-API-Key') or
               headers.get('x-api-key'))

    if not api_key or not api_key.startswith('wh_admin'):
        return ErrorResponses.unauthorized('Admin access required')

    # Parse request body
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        return ErrorResponses.bad_request('Invalid JSON in request body')

    # Validate required fields
    name = body.get('name')
    email = body.get('email')
    password = body.get('password')
    role = body.get('role', 'admin')

    if not all([name, email, password]):
        return ErrorResponses.bad_request('Name, email, and password are required')

    # Validate role
    valid_roles = ['super_admin', 'admin', 'viewer', 'tester', 'rtb']
    if role not in valid_roles:
        return ErrorResponses.bad_request(f'Invalid role. Must be one of: {", ".join(valid_roles)}')

    # Check if email already exists
    existing_user = query_one("SELECT id FROM admins WHERE email = %s", (email,))
    if existing_user:
        return ErrorResponses.bad_request('Email already exists')

    # Hash password
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    # Generate API key
    import hashlib
    import secrets
    admin_id = str(uuid.uuid4())
    api_key_plain = f"wh_admin_{secrets.token_hex(32)}"
    api_key_hash = hashlib.sha256(api_key_plain.encode()).hexdigest()

    # Insert admin user
    insert_sql = """
        INSERT INTO admins (id, name, email, password_hash, api_key, api_key_hash, role, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'active')
        RETURNING id, name, email, role, status, created_at
    """

    result = query_one(insert_sql, (admin_id, name, email, password_hash, api_key_plain, api_key_hash, role))

    if not result:
        return ErrorResponses.internal_server_error('Failed to create admin user')

    # Return created user with API key (only time it's shown)
    response_data = {
        'id': str(result['id']),
        'name': result['name'],
        'email': result['email'],
        'role': result['role'],
        'status': result['status'],
        'apiKey': api_key_plain,  # Only shown once
        'createdAt': str(result['created_at'])
    }

    return success_response(response_data, 201)


def handle_update_user(event):
    """
    Handle update admin user
    PATCH /api/v1/admin/users/{user_id}
    """
    return ErrorResponses.not_found('Not implemented')


def handle_delete_user(event):
    """
    Handle delete admin user
    DELETE /api/v1/admin/users/{user_id}
    """
    return ErrorResponses.not_found('Not implemented')
