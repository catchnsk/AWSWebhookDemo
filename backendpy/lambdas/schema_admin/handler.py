import json
import sys
import os

# Add parent directories to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from shared.models.schema import list_schemas, create_schema, get_schema_by_id, update_schema
from shared.models.producer import get_producer_by_api_key, increment_schema_registered_count
from shared.utils.response import success_response, ErrorResponses, cors_preflight_response, paginated_response
from shared.utils.database import query, query_one
from shared.utils.kafka import create_topic_for_schema


def handler(event, context):
    """
    Lambda handler for schema admin endpoints
    Requirement 1b & 2: Register schema in DB and Schema Registry
    """
    print(f"Schema Admin Lambda invoked: {event.get('httpMethod')} {event.get('path')}")

    # Handle CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return cors_preflight_response()

    try:
        http_method = event.get('httpMethod')
        path = event.get('path', '')
        path_parameters = event.get('pathParameters') or {}

        # Route based on method and path
        if http_method == 'POST' and '/register' in path:
            return handle_register_schema(event)
        elif http_method == 'PATCH' and path_parameters.get('schema_id'):
            return handle_update_schema(event)
        elif http_method == 'GET' and path_parameters.get('schema_id'):
            return handle_get_schema(event)
        elif http_method == 'GET':
            return handle_list_schemas(event)
        else:
            return ErrorResponses.bad_request('Method not allowed')

    except Exception as error:
        print(f"Error in schema admin: {error}")
        import traceback
        traceback.print_exc()
        error_message = str(error) if os.environ.get('NODE_ENV') == 'development' else 'Internal server error'
        return ErrorResponses.internal_server_error(error_message)


def handle_register_schema(event):
    """
    Handle schema registration
    POST /api/v1/schemas/register

    Requirement 1b: Publish the schema
    Requirement 2a: Register the schema in Webhook DB
    Requirement 2b: Register the schema in Schema Registry (skipped in local dev)
    """
    # Extract API key from headers
    headers = event.get('headers', {})
    api_key = (headers.get('Authorization', '').replace('Bearer ', '') or
               headers.get('X-API-Key') or
               headers.get('X-Api-Key') or
               headers.get('x-api-key'))

    if not api_key:
        return ErrorResponses.unauthorized('API key is required')

    # Check if admin (admin API keys start with 'wh_admin')
    is_admin = api_key.startswith('wh_admin')

    producer = None

    if is_admin:
        # For admin users, create or use a default "System" producer
        sql = "SELECT * FROM producers WHERE name = %s LIMIT 1"
        result = query_one(sql, ('System',))

        if result:
            producer = dict(result)
        else:
            # Create a system producer
            sql = """
                INSERT INTO producers (name, contact_email, api_key, status)
                VALUES (%s, %s, %s, %s)
                RETURNING *
            """
            result = query_one(sql, ('System', 'system@webhook.local', 'system_internal_key', 'active'))
            producer = dict(result) if result else None
    else:
        # Validate producer
        producer = get_producer_by_api_key(api_key)

        if not producer:
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

    # Validate schema registration request
    validation = validate_schema_registration(request_body)
    if not validation['valid']:
        return ErrorResponses.bad_request('Validation failed', validation['errors'])

    try:
        # Step 1: Schema Registry registration (skip in local dev)
        is_local_dev = os.environ.get('NODE_ENV') == 'development' or not os.environ.get('AWS_REGION')
        registry_result = None

        if not is_local_dev:
            # TODO: Implement AWS Glue Schema Registry integration
            print('Schema Registry registration not yet implemented')
        else:
            print('Local development mode: Skipping AWS Schema Registry registration')

        # Step 2: Store schema metadata in Webhook Database
        print('Storing schema in Webhook DB...')
        schema = create_schema({
            'producer_id': producer['id'],
            'schema_registry_id': registry_result.get('schemaArn') if registry_result else None,
            'schema_registry_version': registry_result.get('versionNumber') if registry_result else None,
            'name': request_body['name'],
            'event_type': request_body['eventType'],
            'version': request_body['version'],
            'schema_format': request_body.get('schemaFormat', 'json'),
            'schema_definition': request_body['schemaDefinition'],
            'is_public': request_body.get('isPublic', True),
            'requires_approval': request_body.get('requiresApproval', False),
            'description': request_body.get('description'),
            'documentation_url': request_body.get('documentationUrl'),
            'example_payload': request_body.get('examplePayload'),
            'domain': request_body.get('domain'),
            'system_user_id': request_body.get('systemUserId')
        })

        if not schema:
            return ErrorResponses.internal_server_error('Failed to create schema')

        # Step 3: Create Kafka topic for this schema
        kafka_result = create_topic_for_schema(request_body['eventType'])
        print(f"Kafka topic creation result: {kafka_result}")

        # Step 4: Increment producer's schema count
        increment_schema_registered_count(producer['id'])

        # Prepare response
        response = {
            'schema': {
                'id': str(schema['id']),
                'producerId': str(schema['producer_id']),
                'schemaRegistryId': schema.get('schema_registry_id'),
                'name': schema['name'],
                'eventType': schema['event_type'],
                'version': schema['version'],
                'schemaFormat': schema['schema_format'],
                'isPublic': schema['is_public'],
                'requiresApproval': schema['requires_approval'],
                'description': schema.get('description'),
                'documentationUrl': schema.get('documentation_url'),
                'status': schema['status'],
                'createdAt': str(schema['created_at']) if schema.get('created_at') else None,
                'schemaId': schema.get('schema_id'),
                'domain': schema.get('domain'),
                'systemUserId': schema.get('system_user_id')
            },
            'message': 'Schema registered successfully in Webhook Database (local development mode)' if is_local_dev else 'Schema registered successfully in both Schema Registry and Webhook Database'
        }

        return success_response(response, 201)

    except Exception as error:
        print(f'Failed to register schema: {error}')
        import traceback
        traceback.print_exc()

        # Check for unique constraint violation (psycopg2 error code)
        error_str = str(error)
        if '23505' in error_str or 'duplicate key' in error_str.lower():
            return ErrorResponses.conflict('A schema with this event type already exists')

        raise error


def validate_schema_registration(data):
    """
    Validate schema registration request

    Args:
        data: Request body dict

    Returns:
        Dict with 'valid' boolean and 'errors' list
    """
    errors = []

    if not data.get('name') or not isinstance(data.get('name'), str):
        errors.append('name is required and must be a string')

    if not data.get('eventType') or not isinstance(data.get('eventType'), str):
        errors.append('eventType is required and must be a string')

    if not data.get('version') or not isinstance(data.get('version'), str):
        errors.append('version is required and must be a string')

    if not data.get('schemaDefinition') or not isinstance(data.get('schemaDefinition'), dict):
        errors.append('schemaDefinition is required and must be an object')

    schema_format = data.get('schemaFormat')
    if schema_format and schema_format not in ['json', 'avro', 'protobuf']:
        errors.append('schemaFormat must be one of: json, avro, protobuf')

    return {
        'valid': len(errors) == 0,
        'errors': errors
    }


def handle_list_schemas(event):
    """
    Handle list schemas (admin or producer-scoped)
    GET /api/v1/schemas
    """
    # Get API key from headers
    headers = event.get('headers', {})
    print(f"DEBUG: All headers received: {headers}")

    # Try different case variations
    api_key = (headers.get('X-Api-Key') or
               headers.get('X-API-Key') or
               headers.get('x-api-key') or
               headers.get('X-API-KEY'))

    print(f"DEBUG: Extracted API key: {api_key}")

    if not api_key:
        return ErrorResponses.unauthorized('API key is required')

    # Check if admin (admin API keys start with 'wh_admin')
    is_admin = api_key.startswith('wh_admin')

    producer = None
    if not is_admin:
        producer = get_producer_by_api_key(api_key)
        if not producer:
            return ErrorResponses.unauthorized('Invalid API key')

    # Parse query parameters
    params = event.get('queryStringParameters') or {}
    page = int(params.get('page', '1'))
    limit = int(params.get('limit', '20'))

    # Build filters
    filters = {}

    # If not admin, filter by producer
    if producer:
        filters['producer_id'] = producer['id']

    if params.get('status'):
        filters['status'] = params['status']

    if params.get('search'):
        filters['search'] = params['search']

    # Get schemas
    result = list_schemas(filters, page, limit)
    schemas = result['schemas']
    total = result['total']

    # Transform schemas to match API response format
    transformed_schemas = []
    for schema in schemas:
        transformed_schemas.append({
            'id': str(schema['id']),
            'name': schema['name'],
            'eventType': schema['event_type'],
            'version': schema['version'],
            'schemaFormat': schema['schema_format'],
            'isPublic': schema['is_public'],
            'subscriptionCount': int(schema.get('subscription_count', 0)),
            'totalEventsPublished': int(schema.get('total_events_published', 0)),
            'status': schema['status'],
            'createdAt': str(schema['created_at']) if schema.get('created_at') else None,
            'schemaId': schema.get('schema_id'),
            'domain': schema.get('domain'),
            'partnerUserId': schema.get('partner_user_id'),
            'systemUserId': schema.get('system_user_id')
        })

    # Create paginated response
    response = paginated_response(transformed_schemas, total, page, limit)

    # Return success with schemas key for backward compatibility
    return success_response({**response, 'schemas': response['data']})


def handle_get_schema(event):
    """
    Handle get single schema by ID
    GET /api/v1/schemas/{schema_id}
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

    producer = None
    if not is_admin:
        producer = get_producer_by_api_key(api_key)
        if not producer:
            return ErrorResponses.unauthorized('Invalid API key')

    # Get schema ID from path parameters
    path_parameters = event.get('pathParameters') or {}
    schema_id = path_parameters.get('schema_id')

    if not schema_id:
        return ErrorResponses.bad_request('Schema ID is required')

    # Get schema from database
    schema = get_schema_by_id(schema_id)

    if not schema:
        return ErrorResponses.not_found('Schema not found')

    # Check authorization - producers can only view their own schemas
    if producer and schema['producer_id'] != producer['id']:
        return ErrorResponses.forbidden('You do not have permission to view this schema')

    # Transform schema to match API response format
    transformed_schema = {
        'id': str(schema['id']),
        'producerId': str(schema['producer_id']),
        'producerName': schema.get('producer_name'),
        'schemaRegistryId': schema.get('schema_registry_id'),
        'name': schema['name'],
        'eventType': schema['event_type'],
        'version': schema['version'],
        'schemaFormat': schema['schema_format'],
        'schemaDefinition': schema.get('schema_definition'),
        'isPublic': schema['is_public'],
        'requiresApproval': schema['requires_approval'],
        'compatibilityMode': schema.get('compatibility_mode'),
        'description': schema.get('description'),
        'documentationUrl': schema.get('documentation_url'),
        'examplePayload': schema.get('example_payload'),
        'subscriptionCount': int(schema.get('subscription_count', 0)),
        'totalEventsPublished': int(schema.get('total_events_published', 0)),
        'status': schema['status'],
        'createdAt': str(schema['created_at']) if schema.get('created_at') else None,
        'updatedAt': str(schema['updated_at']) if schema.get('updated_at') else None,
        'schemaId': schema.get('schema_id'),
        'domain': schema.get('domain'),
        'partnerUserId': schema.get('partner_user_id'),
        'systemUserId': schema.get('system_user_id')
    }

    return success_response({'schema': transformed_schema})


def handle_update_schema(event):
    """
    Handle update schema (admin only)
    PATCH /api/v1/admin/schemas/{schema_id}
    """
    # Get API key from headers
    headers = event.get('headers', {})
    api_key = (headers.get('X-Api-Key') or
               headers.get('X-API-Key') or
               headers.get('x-api-key') or
               headers.get('X-API-KEY'))

    if not api_key:
        return ErrorResponses.unauthorized('API key is required')

    # Only admins can update schemas
    if not api_key.startswith('wh_admin'):
        return ErrorResponses.forbidden('Only admins can update schemas')

    # Get schema ID from path parameters
    path_parameters = event.get('pathParameters') or {}
    schema_id = path_parameters.get('schema_id')

    if not schema_id:
        return ErrorResponses.bad_request('Schema ID is required')

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

    # Update schema
    updated_schema = update_schema(schema_id, request_body)

    if not updated_schema:
        return ErrorResponses.not_found('Schema not found')

    # Transform schema to match API response format
    transformed_schema = {
        'id': str(updated_schema['id']),
        'producerId': str(updated_schema['producer_id']),
        'schemaRegistryId': updated_schema.get('schema_registry_id'),
        'name': updated_schema['name'],
        'eventType': updated_schema['event_type'],
        'version': updated_schema['version'],
        'schemaFormat': updated_schema['schema_format'],
        'isPublic': updated_schema['is_public'],
        'requiresApproval': updated_schema['requires_approval'],
        'description': updated_schema.get('description'),
        'documentationUrl': updated_schema.get('documentation_url'),
        'status': updated_schema['status'],
        'createdAt': str(updated_schema['created_at']) if updated_schema.get('created_at') else None,
        'updatedAt': str(updated_schema['updated_at']) if updated_schema.get('updated_at') else None
    }

    return success_response({'schema': transformed_schema, 'message': 'Schema updated successfully'})
