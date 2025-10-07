from ..utils.database import query, query_one


def list_subscriptions(filters=None, page=1, limit=20):
    """
    List subscriptions with pagination and schema details

    Args:
        filters: Optional dict with subscriber_id, status, enabled
        page: Page number (1-indexed)
        limit: Number of results per page

    Returns:
        Dict with 'subscriptions' array and 'total' count
    """
    offset = (page - 1) * limit
    conditions = []
    params = []

    # Build WHERE conditions
    if filters:
        if filters.get('subscriber_id'):
            conditions.append("s.subscriber_id = %s")
            params.append(filters['subscriber_id'])

        if filters.get('status'):
            conditions.append("s.status = %s")
            params.append(filters['status'])

        if filters.get('enabled') is not None:
            conditions.append("s.enabled = %s")
            params.append(filters['enabled'])

    # Always filter out cancelled subscriptions
    conditions.append("s.cancelled_at IS NULL")

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Get total count
    count_sql = f"SELECT COUNT(*) as total FROM subscriptions s {where_clause}"
    total_result = query_one(count_sql, params)
    total = total_result['total'] if total_result else 0

    # Get paginated results with schema details
    subscriptions_sql = f"""
        SELECT
            s.id,
            s.subscriber_id,
            s.schema_id,
            s.webhook_url,
            s.max_retries,
            s.backoff_strategy,
            s.enabled,
            s.status,
            s.total_deliveries,
            s.successful_deliveries,
            s.failed_deliveries,
            s.created_at,
            sch.id as schema_pk_id,
            sch.name as schema_name,
            sch.event_type as schema_event_type,
            sch.version as schema_version
        FROM subscriptions s
        LEFT JOIN schemas sch ON sch.id = s.schema_id
        {where_clause}
        ORDER BY s.created_at DESC
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])
    subscriptions = query(subscriptions_sql, params)

    return {
        'subscriptions': [dict(sub) for sub in subscriptions] if subscriptions else [],
        'total': total
    }


def get_subscription_by_id(subscription_id):
    """Get subscription by ID"""
    sql = """
        SELECT
            s.*,
            sch.id as schema_pk_id,
            sch.name as schema_name,
            sch.event_type as schema_event_type,
            sch.version as schema_version
        FROM subscriptions s
        LEFT JOIN schemas sch ON sch.id = s.schema_id
        WHERE s.id = %s AND s.cancelled_at IS NULL
    """
    result = query_one(sql, (subscription_id,))
    return dict(result) if result else None


def get_subscriber_by_api_key(api_key):
    """Get subscriber by API key (using hash comparison)"""
    # For now, using simple comparison - should use hash in production
    sql = """
        SELECT * FROM subscribers
        WHERE api_key = %s AND status = 'active'
    """
    result = query_one(sql, (api_key,))
    return dict(result) if result else None
