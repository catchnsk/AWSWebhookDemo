from ..utils.database import query, query_one
import json


def get_schema_by_id(schema_id):
    """
    Get a single schema by ID

    Args:
        schema_id: Schema ID

    Returns:
        Dict with schema details or None if not found
    """
    sql = """
        SELECT s.*, p.name as producer_name,
               COUNT(DISTINCT sub.id) as subscription_count,
               COALESCE(SUM(CASE WHEN e.status = 'published' THEN 1 ELSE 0 END), 0) as total_events_published
        FROM schemas s
        LEFT JOIN producers p ON s.producer_id = p.id
        LEFT JOIN subscriptions sub ON s.id = sub.schema_id
        LEFT JOIN events e ON s.id = e.schema_id
        WHERE s.id = %s
        GROUP BY s.id, p.name
    """

    result = query_one(sql, (schema_id,))
    if result:
        schema = dict(result)
        # Parse JSON fields
        if schema.get('schema_definition') and isinstance(schema.get('schema_definition'), str):
            try:
                schema['schema_definition'] = json.loads(schema['schema_definition'])
            except:
                pass

        if schema.get('example_payload') and isinstance(schema.get('example_payload'), str):
            try:
                schema['example_payload'] = json.loads(schema['example_payload'])
            except:
                pass

        return schema
    return None


def update_schema(schema_id, data):
    """
    Update a schema

    Args:
        schema_id: Schema ID
        data: Dict with fields to update (status, description, documentation_url, is_public, requires_approval)

    Returns:
        Dict with updated schema or None if not found
    """
    # Build update query dynamically based on provided fields
    update_fields = []
    params = []

    if 'status' in data:
        update_fields.append('status = %s')
        params.append(data['status'])

    if 'description' in data:
        update_fields.append('description = %s')
        params.append(data['description'])

    if 'documentation_url' in data:
        update_fields.append('documentation_url = %s')
        params.append(data['documentation_url'])

    if 'is_public' in data:
        update_fields.append('is_public = %s')
        params.append(data['is_public'])

    if 'requires_approval' in data:
        update_fields.append('requires_approval = %s')
        params.append(data['requires_approval'])

    if not update_fields:
        # No fields to update, just return current schema
        return get_schema_by_id(schema_id)

    # Add updated_at
    update_fields.append('updated_at = CURRENT_TIMESTAMP')

    # Add schema_id to params
    params.append(schema_id)

    sql = f"""
        UPDATE schemas
        SET {', '.join(update_fields)}
        WHERE id = %s
        RETURNING *
    """

    result = query_one(sql, tuple(params))
    if result:
        return dict(result)
    return None


def create_schema(data):
    """
    Create a new schema in the database

    Args:
        data: Dict with schema fields (producer_id, name, event_type, version,
              schema_format, schema_definition, is_public, requires_approval,
              description, documentation_url, example_payload, domain, system_user_id,
              schema_registry_id, schema_registry_version)

    Returns:
        Dict with created schema
    """
    sql = """
        INSERT INTO schemas (
            producer_id, schema_registry_id, schema_registry_version, name, event_type,
            version, schema_format, schema_definition, is_public, requires_approval,
            compatibility_mode, description, documentation_url, example_payload, domain, system_user_id
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
    """

    # Convert schema_definition and example_payload to JSON strings if they're dicts
    schema_definition = data.get('schema_definition')
    if isinstance(schema_definition, dict):
        schema_definition = json.dumps(schema_definition)

    example_payload = data.get('example_payload')
    if example_payload and isinstance(example_payload, dict):
        example_payload = json.dumps(example_payload)

    params = (
        data['producer_id'],
        data.get('schema_registry_id'),
        data.get('schema_registry_version'),
        data['name'],
        data['event_type'],
        data['version'],
        data.get('schema_format', 'json'),
        schema_definition,
        data.get('is_public', True),
        data.get('requires_approval', False),
        data.get('compatibility_mode', 'backward'),
        data.get('description'),
        data.get('documentation_url'),
        example_payload,
        data.get('domain'),
        data.get('system_user_id')
    )

    result = query_one(sql, params)
    return dict(result) if result else None


def list_schemas(filters=None, page=1, limit=20):
    """
    List schemas with pagination and subscription counts

    Args:
        filters: Optional dict with producer_id, status, search
        page: Page number (1-indexed)
        limit: Number of results per page

    Returns:
        Dict with 'schemas' array and 'total' count
    """
    offset = (page - 1) * limit
    conditions = []
    params = []

    if filters:
        if filters.get('producer_id'):
            conditions.append("s.producer_id = %s")
            params.append(filters['producer_id'])

        if filters.get('status'):
            conditions.append("s.status = %s")
            params.append(filters['status'])

        if filters.get('search'):
            conditions.append("(s.name ILIKE %s OR s.event_type ILIKE %s OR s.description ILIKE %s)")
            search_term = f"%{filters['search']}%"
            params.extend([search_term, search_term, search_term])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Get total count
    count_sql = f"SELECT COUNT(*) as total FROM schemas s {where_clause}"
    total_result = query_one(count_sql, params)
    total = total_result['total'] if total_result else 0

    # Get paginated results with subscription count
    schemas_sql = f"""
        SELECT
            s.id,
            s.name,
            s.event_type,
            s.version,
            s.schema_format,
            s.is_public,
            s.status,
            s.created_at,
            s.domain,
            s.system_user_id,
            s.total_events_published,
            s.schema_id,
            s.partner_user_id,
            COALESCE(COUNT(sub.id), 0) as subscription_count
        FROM schemas s
        LEFT JOIN subscriptions sub ON sub.schema_id = s.id
        {where_clause}
        GROUP BY s.id, s.name, s.event_type, s.version, s.schema_format,
                 s.is_public, s.status, s.created_at, s.domain, s.system_user_id,
                 s.total_events_published, s.schema_id, s.partner_user_id
        ORDER BY s.created_at DESC
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])
    schemas = query(schemas_sql, params)

    return {
        'schemas': [dict(s) for s in schemas] if schemas else [],
        'total': total
    }


def get_schema_by_id(schema_id):
    """Get schema by ID"""
    sql = "SELECT * FROM schemas WHERE id = %s"
    result = query_one(sql, (schema_id,))
    return dict(result) if result else None


def get_schema_by_event_type(event_type, version=None):
    """Get schema by event type and optional version"""
    if version:
        sql = "SELECT * FROM schemas WHERE event_type = %s AND version = %s AND status = 'active'"
        result = query_one(sql, (event_type, version))
    else:
        sql = "SELECT * FROM schemas WHERE event_type = %s AND status = 'active' ORDER BY created_at DESC LIMIT 1"
        result = query_one(sql, (event_type,))

    return dict(result) if result else None
