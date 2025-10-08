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


def publish_event(producer_id, schema_id, event_type, payload):
    """
    Publish an event and queue deliveries to subscribers

    Args:
        producer_id: Producer ID
        schema_id: Schema ID
        event_type: Event type
        payload: Event payload (dict)

    Returns:
        Dict with published event details
    """
    import uuid
    import json

    # Generate event ID
    event_id = str(uuid.uuid4())

    # Find all active subscriptions for this schema
    subscriptions_sql = """
        SELECT id, subscriber_id, webhook_url, webhook_secret, max_retries, backoff_strategy
        FROM subscriptions
        WHERE schema_id = %s AND enabled = true AND status = 'active' AND cancelled_at IS NULL
    """
    subscriptions = query(subscriptions_sql, (schema_id,))
    subscriber_count = len(subscriptions) if subscriptions else 0

    # Insert event message
    event_sql = """
        INSERT INTO event_messages (
            event_id, producer_id, schema_id, event_type, payload,
            subscriber_count, deliveries_queued, deliveries_completed,
            deliveries_failed, published_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        RETURNING *
    """

    # Convert payload to JSON string if it's a dict
    payload_json = json.dumps(payload) if isinstance(payload, dict) else payload

    event = query_one(event_sql, (
        event_id, producer_id, schema_id, event_type, payload_json,
        subscriber_count, subscriber_count, 0, 0
    ))

    # Create delivery queue items for each subscription
    if subscriptions:
        for sub in subscriptions:
            delivery_id = str(uuid.uuid4())
            delivery_sql = """
                INSERT INTO delivery_queue (
                    delivery_id, event_id, subscription_id, subscriber_id,
                    webhook_url, payload, max_retries, backoff_strategy,
                    status, attempt_count
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            query(delivery_sql, (
                delivery_id, event_id, sub['id'], sub['subscriber_id'],
                sub['webhook_url'], payload_json, sub['max_retries'],
                sub['backoff_strategy'], 'queued', 0
            ))

    # Update producer stats
    from .producer import increment_event_published_count
    increment_event_published_count(producer_id)

    print(f"DEBUG: About to publish event to Kafka for event_type: {event_type}")

    # Publish event to Kafka
    from ..utils.kafka import publish_event_to_kafka
    kafka_event_data = {
        'event_id': event_id,
        'producer_id': producer_id,
        'schema_id': schema_id,
        'event_type': event_type,
        'payload': payload,
        'subscriber_count': subscriber_count,
        'published_at': str(event['published_at']) if event and event.get('published_at') else None
    }

    print(f"DEBUG: Calling publish_event_to_kafka with data: {kafka_event_data}")
    kafka_result = publish_event_to_kafka(event_type, kafka_event_data)
    print(f"DEBUG: Kafka publish result: {kafka_result}")

    return dict(event) if event else None
