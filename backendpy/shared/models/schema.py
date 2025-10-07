from ..utils.database import query, query_one
import json


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
