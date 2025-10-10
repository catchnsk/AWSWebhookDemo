#!/usr/bin/env python3
"""
Kafka Consumer-Based Webhook Delivery Worker
Real-time event-driven webhook delivery using Kafka consumers
"""
import os
import sys
import time
import json
import requests
import hashlib
import hmac
from datetime import datetime, timedelta
from dotenv import load_dotenv
from kafka import KafkaConsumer
from kafka.errors import KafkaError

# Load environment variables
load_dotenv()

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from shared.utils.database import query, query_one

# Configuration
KAFKA_BROKERS = os.environ.get('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092').split(',')
CONSUMER_GROUP_ID = os.environ.get('KAFKA_CONSUMER_GROUP', 'webhook-delivery-worker')
REQUEST_TIMEOUT = int(os.environ.get('DELIVERY_REQUEST_TIMEOUT', '30'))  # seconds
MAX_RETRIES_DEFAULT = 3
AUTO_COMMIT = os.environ.get('KAFKA_AUTO_COMMIT', 'false').lower() == 'true'

# Statistics
stats = {
    'messages_processed': 0,
    'deliveries_success': 0,
    'deliveries_failed': 0,
    'start_time': datetime.utcnow()
}


def calculate_backoff_delay(attempt, strategy='exponential'):
    """
    Calculate backoff delay based on strategy

    Args:
        attempt: Current attempt number (0-indexed)
        strategy: 'exponential', 'linear', or 'fixed'

    Returns:
        Delay in seconds
    """
    if strategy == 'exponential':
        # 1s, 2s, 4s, 8s, 16s, 32s, 64s...
        return min(2 ** attempt, 300)  # Cap at 5 minutes
    elif strategy == 'linear':
        # 5s, 10s, 15s, 20s, 25s...
        return min((attempt + 1) * 5, 300)
    else:  # fixed
        return 30  # 30 seconds fixed delay


def generate_webhook_signature(payload_str, secret):
    """
    Generate HMAC signature for webhook payload

    Args:
        payload_str: JSON string of payload
        secret: Webhook secret from subscription

    Returns:
        HMAC signature string
    """
    if not secret:
        return None

    signature = hmac.new(
        secret.encode('utf-8'),
        payload_str.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    return f'sha256={signature}'


def send_webhook(webhook_url, payload, subscription, event_id, delivery_id):
    """
    Send webhook HTTP POST request

    Args:
        webhook_url: Webhook URL to send to
        payload: Event payload (dict)
        subscription: Subscription dict with secret
        event_id: Event ID
        delivery_id: Unique delivery ID

    Returns:
        Tuple of (success: bool, status_code: int, response_body: str, error: str, latency_ms: int, headers: dict)
    """
    # Convert payload to JSON string
    if isinstance(payload, dict):
        payload_str = json.dumps(payload)
    else:
        payload_str = str(payload)

    webhook_secret = subscription.get('webhook_secret', '')

    # Build headers
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'WebhookSystem/1.0',
        'X-Webhook-Delivery-ID': delivery_id,
        'X-Webhook-Event-ID': event_id,
        'X-Webhook-Timestamp': datetime.utcnow().isoformat() + 'Z',
    }

    # Add signature if webhook secret exists
    if webhook_secret:
        signature = generate_webhook_signature(payload_str, webhook_secret)
        if signature:
            headers['X-Webhook-Signature'] = signature

    try:
        start_time = time.time()
        response = requests.post(
            webhook_url,
            data=payload_str,
            headers=headers,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True
        )
        latency_ms = int((time.time() - start_time) * 1000)

        success = 200 <= response.status_code < 300

        return (
            success,
            response.status_code,
            response.text[:5000] if response.text else '',  # Limit response body size
            None,
            latency_ms,
            headers
        )

    except requests.exceptions.Timeout:
        return (False, None, None, 'Request timeout', None, headers)
    except requests.exceptions.ConnectionError as e:
        return (False, None, None, f'Connection error: {str(e)}', None, headers)
    except requests.exceptions.RequestException as e:
        return (False, None, None, f'Request error: {str(e)}', None, headers)
    except Exception as e:
        return (False, None, None, f'Unexpected error: {str(e)}', None, headers)


def create_delivery_log(event_id, subscription_id, subscriber_id, delivery_id, webhook_url, payload,
                        success, status_code, response_body, error, latency_ms, request_headers, attempt=0):
    """
    Create a delivery log entry

    Args:
        event_id: Event ID
        subscription_id: Subscription ID
        subscriber_id: Subscriber ID
        delivery_id: Delivery ID
        webhook_url: Webhook URL
        payload: Event payload
        success: Whether delivery was successful
        status_code: HTTP response status code
        response_body: HTTP response body
        error: Error message if failed
        latency_ms: Request latency in milliseconds
        request_headers: Request headers sent
        attempt: Retry attempt number
    """
    status = 'success' if success else 'failed'

    sql = """
        INSERT INTO delivery_logs (
            delivery_id, event_id, subscription_id, subscriber_id,
            request_url, request_method, request_headers, request_payload,
            response_status_code, response_body,
            status, retry_attempt, latency_ms, error_message
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """

    result = query_one(sql, (
        delivery_id,
        event_id,
        subscription_id,
        subscriber_id,
        webhook_url,
        'POST',
        json.dumps(request_headers),
        json.dumps(payload) if isinstance(payload, dict) else str(payload),
        status_code,
        response_body,
        status,
        attempt,
        latency_ms,
        error
    ))

    return result['id'] if result else None


def move_to_dlq(delivery_log_id, final_error, total_attempts, payload):
    """
    Move failed delivery to Dead Letter Queue

    Args:
        delivery_log_id: Delivery log entry ID
        final_error: Final error message
        total_attempts: Total number of attempts made
        payload: Event payload
    """
    sql = """
        INSERT INTO delivery_dlq (
            delivery_log_id, final_error, total_attempts, payload
        ) VALUES (%s, %s, %s, %s)
    """

    query(sql, (
        delivery_log_id,
        final_error,
        total_attempts,
        json.dumps(payload) if isinstance(payload, dict) else str(payload)
    ))


def update_subscription_stats(subscription_id, success):
    """
    Update subscription delivery statistics

    Args:
        subscription_id: Subscription ID
        success: Whether delivery was successful
    """
    if success:
        sql = """
            UPDATE subscriptions
            SET successful_deliveries = successful_deliveries + 1,
                total_deliveries = total_deliveries + 1
            WHERE id = %s
        """
    else:
        sql = """
            UPDATE subscriptions
            SET failed_deliveries = failed_deliveries + 1,
                total_deliveries = total_deliveries + 1
            WHERE id = %s
        """

    query(sql, (subscription_id,))


def get_subscriptions_for_schema(schema_id):
    """
    Get active subscriptions for a schema

    Args:
        schema_id: Schema ID

    Returns:
        List of subscription dicts
    """
    sql = """
        SELECT
            s.id, s.subscriber_id, s.webhook_url, s.webhook_secret,
            s.max_retries, s.backoff_strategy, s.enabled, s.status
        FROM subscriptions s
        WHERE s.schema_id = %s
          AND s.enabled = true
          AND s.status = 'active'
          AND s.cancelled_at IS NULL
    """

    result = query(sql, (schema_id,))
    return [dict(row) for row in result] if result else []


def queue_for_retry(event_id, subscription, delivery_id, payload):
    """
    Queue failed delivery for async retry by polling worker

    Args:
        event_id: Event ID
        subscription: Subscription dict
        delivery_id: Delivery ID
        payload: Event payload

    Returns:
        True if successfully queued, False otherwise
    """
    try:
        sql = """
            INSERT INTO delivery_queue (
                delivery_id, event_id, subscription_id, subscriber_id,
                webhook_url, payload, max_retries, backoff_strategy,
                status, attempt_count, next_retry_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP + INTERVAL '1 second')
        """

        payload_json = json.dumps(payload) if isinstance(payload, dict) else str(payload)

        query(sql, (
            delivery_id,
            event_id,
            subscription['id'],
            subscription['subscriber_id'],
            subscription['webhook_url'],
            payload_json,
            subscription['max_retries'],
            subscription['backoff_strategy'],
            'retrying',
            1  # First retry will be attempt 1
        ))

        return True
    except Exception as e:
        print(f"    ERROR: Failed to queue for retry: {e}")
        import traceback
        traceback.print_exc()
        return False


def deliver_to_subscription(event, subscription, attempt=0):
    """
    Deliver event to a single subscription (first attempt only)
    Failed deliveries are queued for async retry

    Args:
        event: Event dict
        subscription: Subscription dict
        attempt: Current attempt number (should always be 0 for Kafka worker)

    Returns:
        True if successful, False otherwise
    """
    import uuid

    delivery_id = str(uuid.uuid4())
    event_id = event['event_id']

    print(f"  → Delivering to {subscription['webhook_url']}...")

    # Send webhook (first attempt)
    success, status_code, response_body, error, latency_ms, request_headers = send_webhook(
        subscription['webhook_url'],
        event['payload'],
        subscription,
        event_id,
        delivery_id
    )

    # Create delivery log
    log_id = create_delivery_log(
        event_id,
        subscription['id'],
        subscription['subscriber_id'],
        delivery_id,
        subscription['webhook_url'],
        event['payload'],
        success,
        status_code,
        response_body,
        error,
        latency_ms,
        request_headers,
        0  # First attempt
    )

    # Update subscription statistics
    update_subscription_stats(subscription['id'], success)

    if success:
        print(f"    ✓ Success: {status_code} ({latency_ms}ms)")
        stats['deliveries_success'] += 1
        return True
    else:
        print(f"    ✗ Failed: {error or f'HTTP {status_code}'}")
        stats['deliveries_failed'] += 1

        # Queue for async retry by polling worker
        backoff_delay = calculate_backoff_delay(0, subscription['backoff_strategy'])
        if queue_for_retry(event_id, subscription, delivery_id, event['payload']):
            print(f"    → Queued for retry (polling worker will retry in ~{backoff_delay}s)")
        else:
            # If queueing fails, move to DLQ immediately
            if log_id:
                move_to_dlq(log_id, error or f'HTTP {status_code}', 1, event['payload'])
                print(f"    → Failed to queue, moved to DLQ")

        return False


def process_kafka_message(message):
    """
    Process a single Kafka message and deliver to all subscribers

    Args:
        message: Kafka message object

    Returns:
        True if processed successfully, False otherwise
    """
    try:
        # Parse message value
        event_data = json.loads(message.value.decode('utf-8'))

        # Extract schema_id and event details
        schema_id = event_data.get('schema_id')
        event_id = event_data.get('event_id')

        if not schema_id or not event_id:
            print(f"  ⚠ Invalid event data (missing schema_id or event_id): {event_data}")
            return False

        print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Processing event {event_id}")
        print(f"  Topic: {message.topic}")
        print(f"  Partition: {message.partition}")
        print(f"  Offset: {message.offset}")
        print(f"  Schema ID: {schema_id}")

        # Get subscriptions for this schema
        subscriptions = get_subscriptions_for_schema(schema_id)

        if not subscriptions:
            print(f"  No active subscriptions for schema {schema_id}")
            stats['messages_processed'] += 1
            return True

        print(f"  Found {len(subscriptions)} active subscription(s)")

        # Deliver to each subscription
        for subscription in subscriptions:
            try:
                deliver_to_subscription(event_data, subscription)
            except Exception as e:
                print(f"  ERROR delivering to subscription {subscription['id']}: {e}")
                import traceback
                traceback.print_exc()

        stats['messages_processed'] += 1
        return True

    except json.JSONDecodeError as e:
        print(f"  ERROR: Invalid JSON in message: {e}")
        return False
    except Exception as e:
        print(f"  ERROR processing message: {e}")
        import traceback
        traceback.print_exc()
        return False


def print_stats():
    """Print worker statistics"""
    uptime = datetime.utcnow() - stats['start_time']
    print("\n" + "=" * 70)
    print("Worker Statistics")
    print("=" * 70)
    print(f"Uptime: {uptime}")
    print(f"Messages Processed: {stats['messages_processed']}")
    print(f"Successful Deliveries: {stats['deliveries_success']}")
    print(f"Failed Deliveries: {stats['deliveries_failed']}")
    if stats['deliveries_success'] + stats['deliveries_failed'] > 0:
        success_rate = (stats['deliveries_success'] / (stats['deliveries_success'] + stats['deliveries_failed'])) * 100
        print(f"Success Rate: {success_rate:.2f}%")
    print("=" * 70 + "\n")


def consumer_loop():
    """
    Main consumer loop - subscribes to Kafka topics and processes events
    """
    print("=" * 70)
    print("Kafka Consumer-Based Webhook Delivery Worker Started")
    print("=" * 70)
    print(f"Kafka Brokers: {KAFKA_BROKERS}")
    print(f"Consumer Group: {CONSUMER_GROUP_ID}")
    print(f"Request Timeout: {REQUEST_TIMEOUT}s")
    print(f"Auto Commit: {AUTO_COMMIT}")
    print("=" * 70)
    print("\nSubscribing to all topics (pattern: '.*')...")
    print("Waiting for events...\n")

    # Create Kafka consumer
    # Subscribe to all topics using pattern matching
    consumer = KafkaConsumer(
        bootstrap_servers=KAFKA_BROKERS,
        group_id=CONSUMER_GROUP_ID,
        auto_offset_reset='earliest',  # Start from beginning if no committed offset
        enable_auto_commit=AUTO_COMMIT,  # Manual commit for better control
        value_deserializer=None,  # We'll handle deserialization manually
        consumer_timeout_ms=1000,  # Timeout for polling (allows graceful shutdown)
    )

    # Subscribe to all topics using pattern
    # Note: Kafka Python doesn't support regex subscription, so we need to list topics
    # In production, you'd either:
    # 1. Subscribe to specific topics dynamically
    # 2. Use a different Kafka client that supports regex
    # 3. Subscribe to all topics manually

    # For now, let's get all topics and subscribe
    from shared.utils.database import query as db_query
    topics_sql = "SELECT DISTINCT event_type FROM schemas WHERE event_type IS NOT NULL"
    schema_topics = db_query(topics_sql, ())

    if schema_topics:
        # Convert event types to topic names (replace . with -)
        topics = [row['event_type'].replace('.', '-') for row in schema_topics]
        print(f"Subscribing to topics: {topics}\n")
        consumer.subscribe(topics)
    else:
        print("⚠ No schemas found in database. Worker will wait for topics...")

    last_stats_print = time.time()
    stats_interval = 60  # Print stats every 60 seconds

    try:
        for message in consumer:
            try:
                # Process the message
                success = process_kafka_message(message)

                # Manual commit if not auto-committing
                if not AUTO_COMMIT and success:
                    consumer.commit()

            except Exception as e:
                print(f"ERROR processing message: {e}")
                import traceback
                traceback.print_exc()

            # Print stats periodically
            if time.time() - last_stats_print >= stats_interval:
                print_stats()
                last_stats_print = time.time()

    except KeyboardInterrupt:
        print("\n\nShutdown requested... Closing consumer...")
        print_stats()

    finally:
        consumer.close()
        print("Consumer closed. Goodbye!")


if __name__ == '__main__':
    try:
        consumer_loop()
    except Exception as e:
        print(f"FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
