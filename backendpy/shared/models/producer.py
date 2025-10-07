from ..utils.database import query, query_one
from ..utils.crypto import generate_api_key, hash_api_key


def create_producer(name, contact_email, description=None, contact_name=None, department=None):
    """Create a new producer"""
    api_key = generate_api_key('wh_prod')
    api_key_hash = hash_api_key(api_key)

    sql = """
        INSERT INTO producers (name, description, api_key, api_key_hash, contact_email, contact_name, department)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING *
    """

    producer = query_one(sql, (name, description, api_key, api_key_hash, contact_email, contact_name, department))
    return {
        'producer': dict(producer) if producer else None,
        'apiKey': api_key
    }


def get_producer_by_id(producer_id):
    """Get producer by ID"""
    sql = "SELECT * FROM producers WHERE id = %s"
    result = query_one(sql, (producer_id,))
    return dict(result) if result else None


def get_producer_by_api_key(api_key):
    """Get producer by API key"""
    api_key_hash = hash_api_key(api_key)
    sql = "SELECT * FROM producers WHERE api_key_hash = %s AND status = 'active'"
    result = query_one(sql, (api_key_hash,))
    return dict(result) if result else None


def list_producers(filters=None, page=1, limit=20):
    """List producers with pagination"""
    offset = (page - 1) * limit
    conditions = []
    params = []

    if filters:
        if filters.get('status'):
            conditions.append("status = %s")
            params.append(filters['status'])
        if filters.get('search'):
            conditions.append("(name ILIKE %s OR contact_email ILIKE %s)")
            params.extend([f"%{filters['search']}%", f"%{filters['search']}%"])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Get total count
    count_sql = f"SELECT COUNT(*) as total FROM producers {where_clause}"
    total_result = query_one(count_sql, params)
    total = total_result['total'] if total_result else 0

    # Get paginated results
    producers_sql = f"""
        SELECT * FROM producers
        {where_clause}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])
    producers = query(producers_sql, params)

    return {
        'producers': [dict(p) for p in producers] if producers else [],
        'total': total
    }


def update_producer(producer_id, data):
    """Update producer"""
    updates = []
    params = []

    if 'name' in data:
        updates.append("name = %s")
        params.append(data['name'])
    if 'description' in data:
        updates.append("description = %s")
        params.append(data['description'])
    if 'contact_email' in data:
        updates.append("contact_email = %s")
        params.append(data['contact_email'])
    if 'contact_name' in data:
        updates.append("contact_name = %s")
        params.append(data['contact_name'])
    if 'department' in data:
        updates.append("department = %s")
        params.append(data['department'])
    if 'status' in data:
        updates.append("status = %s")
        params.append(data['status'])

    if not updates:
        return None

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(producer_id)

    sql = f"""
        UPDATE producers
        SET {', '.join(updates)}
        WHERE id = %s
        RETURNING *
    """

    result = query_one(sql, params)
    return dict(result) if result else None


def increment_event_published_count(producer_id):
    """Increment event published count"""
    sql = """
        UPDATE producers
        SET total_events_published = total_events_published + 1,
            last_published_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """
    query(sql, (producer_id,))


def increment_schema_registered_count(producer_id):
    """Increment schema registered count"""
    sql = """
        UPDATE producers
        SET total_schemas_registered = total_schemas_registered + 1
        WHERE id = %s
    """
    query(sql, (producer_id,))
