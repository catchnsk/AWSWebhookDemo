import json
import sys
import os

# Add parent directories to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from shared.models.producer import create_producer, get_producer_by_api_key
from shared.utils.response import success_response, ErrorResponses, cors_preflight_response
from shared.utils.validation import is_valid_email


def handler(event, context):
    """
    Lambda handler for producer onboarding
    Requirement 1: Message Schema Registration by Producers - Onboarding Process
    """
    print(f"Producer Onboarding Lambda invoked: {event.get('httpMethod')} {event.get('path')}")

    # Handle CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return cors_preflight_response()

    try:
        # Only allow POST requests
        if event.get('httpMethod') != 'POST':
            return ErrorResponses.bad_request('Method not allowed')

        # Parse request body
        body = event.get('body')
        if not body:
            return ErrorResponses.bad_request('Request body is required')

        try:
            request_body = json.loads(body) if isinstance(body, str) else body
        except json.JSONDecodeError:
            return ErrorResponses.bad_request('Invalid JSON in request body')

        # Validate required fields
        validation = validate_producer_onboarding(request_body)
        if not validation['valid']:
            return ErrorResponses.bad_request('Validation failed', validation['errors'])

        # Create producer
        result = create_producer(
            name=request_body['name'],
            description=request_body.get('description'),
            contact_email=request_body['contactEmail'],
            contact_name=request_body.get('contactName'),
            department=request_body.get('department')
        )

        producer = result['producer']
        api_key = result['apiKey']

        # Prepare response
        response_data = {
            'producer': {
                'id': str(producer['id']),
                'name': producer['name'],
                'description': producer.get('description'),
                'contactEmail': producer['contact_email'],
                'contactName': producer.get('contact_name'),
                'department': producer.get('department'),
                'status': producer['status'],
                'createdAt': str(producer['created_at'])
            },
            'apiKey': api_key,
            'message': 'Producer onboarded successfully. Please store your API key securely.'
        }

        return success_response(response_data, 201, 'Producer registered successfully')

    except Exception as error:
        print(f"Error in producer onboarding: {error}")
        error_message = str(error) if os.environ.get('NODE_ENV') == 'development' else 'Failed to onboard producer'
        return ErrorResponses.internal_server_error(error_message)


def validate_producer_onboarding(data):
    """Validate producer onboarding request"""
    errors = []

    # Validate name
    if not data.get('name') or not isinstance(data['name'], str):
        errors.append('name is required and must be a string')
    elif len(data['name']) < 3:
        errors.append('name must be at least 3 characters long')
    elif len(data['name']) > 255:
        errors.append('name must not exceed 255 characters')

    # Validate contact email
    if not data.get('contactEmail') or not isinstance(data['contactEmail'], str):
        errors.append('contactEmail is required and must be a string')
    elif not is_valid_email(data['contactEmail']):
        errors.append('contactEmail must be a valid email address')

    # Validate optional fields
    if 'description' in data and not isinstance(data['description'], str):
        errors.append('description must be a string')

    if 'contactName' in data and not isinstance(data['contactName'], str):
        errors.append('contactName must be a string')

    if 'department' in data and not isinstance(data['department'], str):
        errors.append('department must be a string')

    return {
        'valid': len(errors) == 0,
        'errors': errors
    }
