import re
from ..shared.models.admin import verify_admin_password, update_admin_last_login
from ..shared.utils.response import success_response, bad_request, unauthorized

def validate_email(email):
    """Validate email format"""
    pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    return re.match(pattern, email) is not None

def validate_login_request(data):
    """Validate login request"""
    errors = []

    if not data.get('email') or not isinstance(data['email'], str):
        errors.append('email is required and must be a string')
    elif not validate_email(data['email']):
        errors.append('email must be a valid email address')

    if not data.get('password') or not isinstance(data['password'], str):
        errors.append('password is required and must be a string')

    return {'valid': len(errors) == 0, 'errors': errors}

def handle_login(data):
    """Handle admin login"""
    validation = validate_login_request(data)
    if not validation['valid']:
        return bad_request('Validation failed', validation['errors'])

    try:
        admin = verify_admin_password(data['email'], data['password'])

        if not admin:
            return unauthorized('Invalid email or password')

        # Update last login time
        update_admin_last_login(admin['id'])

        # Prepare response (excluding sensitive data)
        response = {
            'user': {
                'id': admin['id'],
                'name': admin['name'],
                'email': admin['email'],
                'role': admin['role'],
                'status': admin['status'],
            },
            'apiKey': admin['api_key'],
            'message': 'Login successful',
        }

        return success_response(response)
    except Exception as e:
        print(f'Failed to login: {e}')
        raise e
