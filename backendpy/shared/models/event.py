from ..utils.database import query, query_one


def list_events(filters=None, page=1, limit=50):
    """
    List event messages with pagination

    Args:
        filters: Optional dict with producer_id, schema_id, event_type
        page: Page number (1-indexed)
        limit: Number of results per page

    Returns:
        Dict with 'events' array and 'total' count
    """
    offset = (page - 1) * limit
    conditions = []
    params = []

    if filters:
        if filters.get('producer_id'):
            conditions.append("producer_id = %s")
            params.append(filters['producer_id'])

        if filters.get('schema_id'):
            conditions.append("schema_id = %s")
            params.append(filters['schema_id'])

        if filters.get('event_type'):
            conditions.append("event_type = %s")
            params.append(filters['event_type'])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Get total count
    count_sql = f"SELECT COUNT(*) as total FROM event_messages {where_clause}"
    total_result = query_one(count_sql, params)
    total = total_result['total'] if total_result else 0

    # Get paginated results
    events_sql = f"""
        SELECT * FROM event_messages
        {where_clause}
        ORDER BY published_at DESC
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])
    events = query(events_sql, params)

    return {
        'events': [dict(e) for e in events] if events else [],
        'total': total
    }


def get_event_by_id(event_id):
    """Get event message by ID"""
    sql = "SELECT * FROM event_messages WHERE event_id = %s"
    result = query_one(sql, (event_id,))
    return dict(result) if result else None
