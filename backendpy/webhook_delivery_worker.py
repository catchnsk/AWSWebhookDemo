#!/usr/bin/env python3
"""
Webhook Delivery Worker
Processes the delivery queue and sends webhook notifications to subscribers
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

# Load environment variables
load_dotenv()

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from shared.utils.database import query, query_one

# Configuration
POLL_INTERVAL = int(os.environ.get('DELIVERY_POLL_INTERVAL', '2'))  # seconds
BATCH_SIZE = int(os.environ.get('DELIVERY_BATCH_SIZE', '10'))
REQUEST_TIMEOUT = int(os.environ.get('DELIVERY_REQUEST_TIMEOUT', '30'))  # seconds
MAX_RETRIES_DEFAULT = 3


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


def send_webhook(delivery):
    """
    Send webhook HTTP POST request

    Args:
        delivery: Delivery queue entry dict

    Returns:
        Tuple of (success: bool, status_code: int, response_body: str, error: str)
    """
    url = delivery['webhook_url']
    payload = delivery['payload']

    # Convert payload to JSON string
    if isinstance(payload, dict):
        payload_str = json.dumps(payload)
    else:
        payload_str = str(payload)

    # Get webhook secret from subscription
    subscription_sql = "SELECT webhook_secret FROM subscriptions WHERE id = %s"
    subscription = query_one(subscription_sql, (delivery['subscription_id'],))
    webhook_secret = subscription.get('webhook_secret') if subscription else None

    # Build headers
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'WebhookSystem/1.0',
        'X-Webhook-Delivery-ID': delivery['delivery_id'],
        'X-Webhook-Event-ID': delivery['event_id'],
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
            url,
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


def create_delivery_log(delivery, success, status_code, response_body, error, latency_ms, request_headers):
    """
    Create a delivery log entry

    Args:
        delivery: Delivery queue entry
        success: Whether delivery was successful
        status_code: HTTP response status code
        response_body: HTTP response body
        error: Error message if failed
        latency_ms: Request latency in milliseconds
        request_headers: Request headers sent
    """
    import uuid

    status = 'success' if success else ('retrying' if delivery['attempt_count'] < delivery['max_retries'] else 'failed')

    sql = """
        INSERT INTO delivery_logs (
            delivery_id, event_id, subscription_id, subscriber_id,
            request_url, request_method, request_headers, request_payload,
            response_status_code, response_body,
            status, retry_attempt, latency_ms, error_message
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    query(sql, (
        delivery['delivery_id'],
        delivery['event_id'],
        delivery['subscription_id'],
        delivery['subscriber_id'],
        delivery['webhook_url'],
        'POST',
        json.dumps(request_headers),
        delivery['payload'],
        status_code,
        response_body,
        status,
        delivery['attempt_count'],
        latency_ms,
        error
    ))


def move_to_dlq(delivery, final_error):
    """
    Move failed delivery to Dead Letter Queue

    Args:
        delivery: Delivery queue entry
        final_error: Final error message
    """
    sql = """
        INSERT INTO delivery_dlq (
            delivery_log_id, final_error, total_attempts, payload
        )
        SELECT
            dl.id,
            %s,
            %s,
            %s
        FROM delivery_logs dl
        WHERE dl.delivery_id = %s
        ORDER BY dl.created_at DESC
        LIMIT 1
    """

    query(sql, (
        final_error,
        delivery['attempt_count'],
        delivery['payload'],
        delivery['delivery_id']
    ))

    print(f"  → Moved to DLQ: {delivery['delivery_id']} after {delivery['attempt_count']} attempts")


def update_event_stats(event_id, success):
    """
    Update event message delivery statistics

    Args:
        event_id: Event ID
        success: Whether delivery was successful
    """
    if success:
        sql = """
            UPDATE event_messages
            SET deliveries_completed = deliveries_completed + 1
            WHERE event_id = %s
        """
    else:
        sql = """
            UPDATE event_messages
            SET deliveries_failed = deliveries_failed + 1
            WHERE event_id = %s
        """

    query(sql, (event_id,))


def process_delivery(delivery):
    """
    Process a single delivery from the queue

    Args:
        delivery: Delivery queue entry dict

    Returns:
        True if delivery should be removed from queue, False otherwise
    """
    delivery_id = delivery['delivery_id']
    attempt = delivery['attempt_count'] + 1

    print(f"Processing delivery {delivery_id} (attempt {attempt}/{delivery['max_retries'] + 1})...")

    # Update status to processing
    query(
        "UPDATE delivery_queue SET status = 'processing', attempt_count = %s, last_attempt_at = CURRENT_TIMESTAMP WHERE delivery_id = %s",
        (attempt, delivery_id)
    )

    # Send webhook
    success, status_code, response_body, error, latency_ms, request_headers = send_webhook(delivery)

    # Create delivery log
    delivery['attempt_count'] = attempt  # Update for log
    create_delivery_log(delivery, success, status_code, response_body, error, latency_ms, request_headers)

    # Update event statistics
    update_event_stats(delivery['event_id'], success)

    if success:
        print(f"  ✓ Success: {status_code} ({latency_ms}ms)")
        # Remove from queue
        query("DELETE FROM delivery_queue WHERE delivery_id = %s", (delivery_id,))
        return True

    else:
        print(f"  ✗ Failed: {error or f'HTTP {status_code}'}")

        # Check if we should retry
        if attempt < delivery['max_retries']:
            # Calculate next retry time
            backoff_delay = calculate_backoff_delay(attempt - 1, delivery['backoff_strategy'])
            next_retry = datetime.utcnow() + timedelta(seconds=backoff_delay)

            print(f"  → Retry scheduled in {backoff_delay}s (at {next_retry.strftime('%H:%M:%S')})")

            # Update queue entry for retry
            query(
                "UPDATE delivery_queue SET status = 'retrying', next_retry_at = %s WHERE delivery_id = %s",
                (next_retry, delivery_id)
            )
            return False

        else:
            print(f"  ✗ Max retries reached ({delivery['max_retries']})")
            # Move to DLQ and remove from queue
            move_to_dlq(delivery, error or f'HTTP {status_code}')
            query("DELETE FROM delivery_queue WHERE delivery_id = %s", (delivery_id,))
            return True


def fetch_pending_deliveries():
    """
    Fetch pending deliveries from the queue

    Returns:
        List of delivery entries ready to process
    """
    sql = """
        SELECT
            id, delivery_id, event_id, subscription_id, subscriber_id,
            webhook_url, payload, max_retries, backoff_strategy,
            status, attempt_count
        FROM delivery_queue
        WHERE status IN ('queued', 'retrying')
          AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)
        ORDER BY created_at ASC
        LIMIT %s
    """

    result = query(sql, (BATCH_SIZE,))
    return [dict(row) for row in result] if result else []


def worker_loop():
    """
    Main worker loop - continuously processes the delivery queue
    """
    print("=" * 70)
    print("Webhook Delivery Worker Started")
    print("=" * 70)
    print(f"Poll Interval: {POLL_INTERVAL}s")
    print(f"Batch Size: {BATCH_SIZE}")
    print(f"Request Timeout: {REQUEST_TIMEOUT}s")
    print("=" * 70)
    print()

    iteration = 0

    while True:
        try:
            iteration += 1

            # Fetch pending deliveries
            deliveries = fetch_pending_deliveries()

            if deliveries:
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Iteration #{iteration}: Processing {len(deliveries)} deliveries...")

                for delivery in deliveries:
                    try:
                        process_delivery(delivery)
                    except Exception as e:
                        print(f"  ERROR processing {delivery['delivery_id']}: {e}")
                        import traceback
                        traceback.print_exc()

                print()

            # Wait before next poll
            time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            print("\n\nShutdown requested... Exiting gracefully.")
            break

        except Exception as e:
            print(f"ERROR in worker loop: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(POLL_INTERVAL * 2)  # Back off on error


if __name__ == '__main__':
    try:
        worker_loop()
    except Exception as e:
        print(f"FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
