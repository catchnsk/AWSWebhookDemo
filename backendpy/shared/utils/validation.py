import re
from typing import Dict, List, Any
from urllib.parse import urlparse
import jsonschema
from jsonschema import validate, ValidationError


def validate_schema(schema: Dict[str, Any], data: Any) -> Dict[str, Any]:
    """Validate data against JSON schema"""
    try:
        validate(instance=data, schema=schema)
        return {'valid': True, 'errors': []}
    except ValidationError as e:
        return {
            'valid': False,
            'errors': [{
                'path': '/' + '/'.join(str(p) for p in e.path) if e.path else '/root',
                'message': e.message
            }]
        }
    except Exception as e:
        return {
            'valid': False,
            'errors': [{'path': '', 'message': f'Invalid schema: {str(e)}'}]
        }


def validate_webhook_payload(payload: Any) -> Dict[str, Any]:
    """Validate webhook payload"""
    errors = []

    if not payload or not isinstance(payload, dict):
        errors.append('Payload must be a valid object')

    return {
        'valid': len(errors) == 0,
        'errors': errors
    }


def is_valid_url(url: str) -> bool:
    """Validate URL format"""
    try:
        result = urlparse(url)
        return result.scheme in ('http', 'https') and bool(result.netloc)
    except Exception:
        return False


def validate_webhook_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Validate webhook configuration"""
    errors = []

    # Validate name
    if not config.get('name') or not isinstance(config['name'], str):
        errors.append('Name is required and must be a string')
    elif len(config['name']) > 255:
        errors.append('Name must not exceed 255 characters')

    # Validate URL
    if not config.get('url') or not isinstance(config['url'], str):
        errors.append('URL is required and must be a string')
    elif not is_valid_url(config['url']):
        errors.append('URL must be a valid HTTP or HTTPS URL')

    # Validate event type
    if not config.get('eventType') or not isinstance(config['eventType'], str):
        errors.append('Event type is required and must be a string')

    # Validate authentication type
    auth = config.get('authentication', {})
    if auth.get('type'):
        valid_auth_types = ['bearer', 'api_key', 'oauth2', 'basic', 'none']
        if auth['type'] not in valid_auth_types:
            errors.append(f"Authentication type must be one of: {', '.join(valid_auth_types)}")

    # Validate retry policy
    retry_policy = config.get('retryPolicy', {})
    if 'maxRetries' in retry_policy:
        max_retries = retry_policy['maxRetries']
        if not isinstance(max_retries, int) or max_retries < 0 or max_retries > 10:
            errors.append('Max retries must be between 0 and 10')

    if retry_policy.get('backoffStrategy'):
        valid_strategies = ['exponential', 'linear', 'constant']
        if retry_policy['backoffStrategy'] not in valid_strategies:
            errors.append(f"Backoff strategy must be one of: {', '.join(valid_strategies)}")

    if 'initialDelayMs' in retry_policy:
        initial_delay = retry_policy['initialDelayMs']
        if not isinstance(initial_delay, int) or initial_delay < 100:
            errors.append('Initial delay must be at least 100ms')

    # Validate timeout
    if 'timeoutMs' in config:
        timeout = config['timeoutMs']
        if not isinstance(timeout, int) or timeout < 1000 or timeout > 300000:
            errors.append('Timeout must be between 1000ms and 300000ms')

    return {
        'valid': len(errors) == 0,
        'errors': errors
    }


def sanitize_string(input_str: str, max_length: int = 255) -> str:
    """Sanitize input string"""
    return input_str.strip()[:max_length]


def validate_pagination(page: Any = None, limit: Any = None) -> Dict[str, Any]:
    """Validate pagination parameters"""
    errors = []
    valid_page = 1
    valid_limit = 20

    if page is not None:
        try:
            parsed_page = int(page)
            if parsed_page < 1:
                errors.append('Page must be a positive integer')
            else:
                valid_page = parsed_page
        except (ValueError, TypeError):
            errors.append('Page must be a positive integer')

    if limit is not None:
        try:
            parsed_limit = int(limit)
            if parsed_limit < 1:
                errors.append('Limit must be a positive integer')
            elif parsed_limit > 100:
                errors.append('Limit must not exceed 100')
            else:
                valid_limit = parsed_limit
        except (ValueError, TypeError):
            errors.append('Limit must be a positive integer')

    return {
        'page': valid_page,
        'limit': valid_limit,
        'errors': errors
    }


def is_valid_email(email: str) -> bool:
    """Validate email format"""
    email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    return bool(re.match(email_regex, email))


def is_valid_uuid(uuid_str: str) -> bool:
    """Validate UUID format"""
    uuid_regex = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    return bool(re.match(uuid_regex, uuid_str, re.IGNORECASE))
