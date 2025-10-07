import json

def success_response(data, status_code=200, message=None):
    """Return success response in Lambda format"""
    body = {
        'success': True,
        'data': data
    }
    if message:
        body['message'] = message

    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(body)
    }

def error_response(message, status_code=400, code='BAD_REQUEST', errors=None):
    """Return error response in Lambda format"""
    response = {
        'success': False,
        'error': {
            'code': code,
            'message': message
        }
    }
    if errors:
        response['error']['errors'] = errors

    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(response)
    }

def bad_request(message, errors=None):
    """Return 400 Bad Request"""
    return error_response(message, 400, 'BAD_REQUEST', errors)

def unauthorized(message='Unauthorized'):
    """Return 401 Unauthorized"""
    return error_response(message, 401, 'UNAUTHORIZED')

def forbidden(message='Forbidden'):
    """Return 403 Forbidden"""
    return error_response(message, 403, 'FORBIDDEN')

def not_found(message='Resource not found'):
    """Return 404 Not Found"""
    return error_response(message, 404, 'NOT_FOUND')

def internal_server_error(message='Internal server error'):
    """Return 500 Internal Server Error"""
    return error_response(message, 500, 'INTERNAL_SERVER_ERROR')

def cors_preflight_response():
    """Return CORS preflight response in Lambda format"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
        },
        'body': ''
    }

class ErrorResponses:
    """Error response helpers"""

    @staticmethod
    def bad_request(message, errors=None):
        return error_response(message, 400, 'BAD_REQUEST', errors)

    @staticmethod
    def unauthorized(message='Unauthorized'):
        return error_response(message, 401, 'UNAUTHORIZED')

    @staticmethod
    def forbidden(message='Forbidden'):
        return error_response(message, 403, 'FORBIDDEN')

    @staticmethod
    def not_found(message='Resource not found'):
        return error_response(message, 404, 'NOT_FOUND')

    @staticmethod
    def conflict(message):
        return error_response(message, 409, 'CONFLICT')

    @staticmethod
    def internal_server_error(message='Internal server error'):
        return error_response(message, 500, 'INTERNAL_SERVER_ERROR')

def paginated_response(data, total, page, limit):
    """
    Create paginated response structure

    Args:
        data: Array of items to return
        total: Total count of items
        page: Current page number
        limit: Items per page

    Returns:
        Dict with data and pagination metadata
    """
    import math
    total_pages = math.ceil(total / limit) if limit > 0 else 0

    return {
        'data': data,
        'pagination': {
            'total': total,
            'page': page,
            'limit': limit,
            'totalPages': total_pages,
            'hasNextPage': page < total_pages,
            'hasPreviousPage': page > 1
        }
    }
