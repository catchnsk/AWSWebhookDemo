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


def create_subscription(data):
    """
    Create a new subscription

    Args:
        data: Dict with subscription fields (subscriber_id, schema_id, webhook_url,
              webhook_secret, max_retries, backoff_strategy, enabled)

    Returns:
        Dict with created subscription
    """
    sql = """
        INSERT INTO subscriptions (
            subscriber_id, schema_id, webhook_url, webhook_secret,
            max_retries, backoff_strategy, enabled, auth_type, status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
    """

    params = (
        data['subscriber_id'],
        data['schema_id'],
        data['webhook_url'],
        data.get('webhook_secret', ''),
        data.get('max_retries', 3),
        data.get('backoff_strategy', 'exponential'),
        data.get('enabled', True),
        data.get('auth_type', 'hmac'),
        data.get('status', 'active')
    )

    result = query_one(sql, params)
    return dict(result) if result else None


def list_subscribers(filters=None, page=1, limit=20):
    """
    List subscribers with pagination

    Args:
        filters: Optional dict with status, search
        page: Page number (1-indexed)
        limit: Number of results per page

    Returns:
        Dict with 'subscribers' array and 'total' count
    """
    offset = (page - 1) * limit
    conditions = []
    params = []

    if filters:
        if filters.get('status'):
            conditions.append("status = %s")
            params.append(filters['status'])

        if filters.get('search'):
            conditions.append("(name ILIKE %s OR email ILIKE %s)")
            search_term = f"%{filters['search']}%"
            params.extend([search_term, search_term])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Get total count
    count_sql = f"SELECT COUNT(*) as total FROM subscribers {where_clause}"
    total_result = query_one(count_sql, params)
    total = total_result['total'] if total_result else 0

    # Get paginated results
    subscribers_sql = f"""
        SELECT id, name, email, webhook_url, webhook_secret, status, created_at, updated_at
        FROM subscribers
        {where_clause}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])
    subscribers = query(subscribers_sql, params)

    return {
        'subscribers': [dict(sub) for sub in subscribers] if subscribers else [],
        'total': total
    }


def update_subscriber(subscriber_id, data):
    """
    Update a subscriber

    Args:
        subscriber_id: Subscriber ID
        data: Dict with fields to update (name, email, webhookUrl, status)

    Returns:
        Dict with updated subscriber or None if not found
    """
    # Build update query dynamically based on provided fields
    update_fields = []
    params = []

    if 'name' in data:
        update_fields.append('name = %s')
        params.append(data['name'])

    if 'email' in data:
        update_fields.append('email = %s')
        params.append(data['email'])

    if 'webhookUrl' in data or 'webhook_url' in data:
        update_fields.append('webhook_url = %s')
        params.append(data.get('webhookUrl') or data.get('webhook_url'))

    if 'status' in data:
        update_fields.append('status = %s')
        params.append(data['status'])

    if not update_fields:
        # No fields to update, just return current subscriber
        sql = "SELECT * FROM subscribers WHERE id = %s"
        result = query_one(sql, (subscriber_id,))
        return dict(result) if result else None

    # Add updated_at
    update_fields.append('updated_at = CURRENT_TIMESTAMP')

    # Add subscriber_id to params
    params.append(subscriber_id)

    sql = f"""
        UPDATE subscribers
        SET {', '.join(update_fields)}
        WHERE id = %s
        RETURNING *
    """

    result = query_one(sql, tuple(params))
    if result:
        return dict(result)
    return None
