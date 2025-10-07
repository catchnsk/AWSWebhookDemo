import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from shared.models.admin import verify_admin_password, update_admin_last_login
from shared.utils.response import success_response, ErrorResponses, cors_preflight_response


def handler(event, context):
    """Lambda handler for admin authentication (login)"""
    print(f"Admin Auth Lambda invoked: {event.get('httpMethod')} {event.get('path')}")

    if event.get('httpMethod') == 'OPTIONS':
        return cors_preflight_response()

    try:
        if event.get('httpMethod') != 'POST':
            return ErrorResponses.bad_request('Method not allowed')

        body = event.get('body')
        if not body:
            return ErrorResponses.bad_request('Request body is required')

        try:
            request_body = json.loads(body) if isinstance(body, str) else body
        except json.JSONDecodeError:
            return ErrorResponses.bad_request('Invalid JSON in request body')

        # Validate login request
        validation = validate_login_request(request_body)
        if not validation['valid']:
            return ErrorResponses.bad_request('Validation failed', validation['errors'])

        # Verify credentials
        admin = verify_admin_password(request_body['email'], request_body['password'])

        if not admin:
            return ErrorResponses.unauthorized('Invalid email or password')

        # Update last login time
        update_admin_last_login(admin['id'])

        # Prepare response
        response_data = {
            'user': {
                'id': str(admin['id']),
                'name': admin['name'],
                'email': admin['email'],
                'role': admin['role'],
                'status': admin['status']
            },
            'apiKey': admin['api_key'],
            'message': 'Login successful'
        }

        return success_response(response_data)

    except Exception as error:
        print(f"Error in admin auth: {error}")
        error_message = str(error) if os.environ.get('NODE_ENV') == 'development' else 'Operation failed'
        return ErrorResponses.internal_server_error(error_message)


def validate_login_request(data):
    """Validate login request"""
    errors = []

    if not data.get('email') or not isinstance(data['email'], str):
        errors.append('email is required and must be a string')

    if not data.get('password') or not isinstance(data['password'], str):
        errors.append('password is required and must be a string')

    return {'valid': len(errors) == 0, 'errors': errors}
