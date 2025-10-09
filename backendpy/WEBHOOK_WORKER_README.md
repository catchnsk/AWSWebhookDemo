# Webhook Delivery Worker

## Overview

The webhook delivery worker processes the delivery queue and sends HTTP POST requests to subscriber webhook URLs with automatic retry logic and failure handling.

## Features

✅ **Automatic delivery** - Processes queued webhook deliveries
✅ **Retry logic** - Supports exponential, linear, and fixed backoff strategies
✅ **HMAC signatures** - Signs requests with webhook secrets
✅ **Delivery logs** - Tracks all delivery attempts with full request/response details
✅ **Dead Letter Queue** - Failed deliveries after max retries go to DLQ
✅ **Event statistics** - Updates delivery counts on event messages

## Quick Start

### 1. Start the Worker

```bash
cd backendpy
./start-worker.sh
```

Or manually:

```bash
cd backendpy
python3 webhook_delivery_worker.py
```

### 2. Test with webhook.site

1. **Get a test webhook URL:**
   - Visit https://webhook.site
   - Copy your unique URL (e.g., `https://webhook.site/your-unique-id`)

2. **Create a subscription:**
   - Go to your admin UI (http://localhost:3002)
   - Navigate to "Manage Subscriptions" → "Subscriptions"
   - Create a new subscription with:
     - Schema: Choose any schema
     - Subscriber: Choose or create a subscriber
     - Webhook URL: Your webhook.site URL
     - Max Retries: 3
     - Backoff Strategy: exponential

3. **Publish a test event:**
   - Go to "Test Event Publisher"
   - Select the schema you subscribed to
   - Fill in the payload
   - Click "Publish Test Event"

4. **Watch the worker logs:**
   - You'll see the worker process the delivery
   - Check webhook.site to see the received webhook

5. **View delivery logs:**
   - Go to "Delivery Monitor" in the UI
   - See the delivery status, attempts, and response

## Configuration

Environment variables (in `.env`):

```bash
# Worker polling settings
DELIVERY_POLL_INTERVAL=2       # How often to check queue (seconds)
DELIVERY_BATCH_SIZE=10         # Max deliveries per batch
DELIVERY_REQUEST_TIMEOUT=30    # HTTP request timeout (seconds)
```

## Retry Logic

### Backoff Strategies

1. **Exponential** (default): 1s → 2s → 4s → 8s → 16s → 32s → 64s...
2. **Linear**: 5s → 10s → 15s → 20s → 25s...
3. **Fixed**: 30s delay for all retries

### Max Retries

Configured per subscription (default: 3 attempts total)

## Database Tables

### `delivery_queue`
Queue of pending deliveries waiting to be sent

- `status`: `queued`, `processing`, `completed`, `failed`, `retrying`
- `attempt_count`: Number of delivery attempts
- `next_retry_at`: Scheduled retry time (if retrying)

### `delivery_logs`
Complete history of all delivery attempts

- Tracks request/response details
- Records latency, status codes, errors
- Linked to events and subscriptions

### `delivery_dlq`
Dead Letter Queue for failed deliveries

- Stores deliveries that exceeded max retries
- Can be manually retried later

## Monitoring

### Check Queue Status

```bash
docker exec webhook-postgres psql -U webhook_user -d webhook_db -c "
SELECT
    status,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM delivery_queue
GROUP BY status;
"
```

### View Recent Deliveries

```bash
docker exec webhook-postgres psql -U webhook_user -d webhook_db -c "
SELECT
    delivery_id,
    event_id,
    status,
    retry_attempt,
    created_at
FROM delivery_logs
ORDER BY created_at DESC
LIMIT 10;
"
```

### Check DLQ Entries

```bash
docker exec webhook-postgres psql -U webhook_user -d webhook_db -c "
SELECT
    id,
    final_error,
    total_attempts,
    moved_to_dlq_at
FROM delivery_dlq
WHERE resolved = false
ORDER BY moved_to_dlq_at DESC;
"
```

## Troubleshooting

### Worker not processing deliveries

1. Check worker is running: `ps aux | grep webhook_delivery_worker`
2. Check database connection in `.env`
3. View worker logs for errors

### Deliveries stuck in queue

```bash
# Check for stuck entries
docker exec webhook-postgres psql -U webhook_user -d webhook_db -c "
SELECT
    delivery_id,
    status,
    attempt_count,
    created_at,
    next_retry_at
FROM delivery_queue
WHERE status = 'processing'
  AND last_attempt_at < NOW() - INTERVAL '5 minutes';
"

# Reset stuck entries
docker exec webhook-postgres psql -U webhook_user -d webhook_db -c "
UPDATE delivery_queue
SET status = 'queued', next_retry_at = NULL
WHERE status = 'processing'
  AND last_attempt_at < NOW() - INTERVAL '5 minutes';
"
```

### View webhook signature verification

The worker sends HMAC signatures in the `X-Webhook-Signature` header:

```
X-Webhook-Signature: sha256=<hmac_signature>
```

To verify on the receiving end:

```python
import hmac
import hashlib

def verify_signature(payload, signature, secret):
    expected = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    return f'sha256={expected}' == signature
```

## Production Deployment

For production, consider:

1. **Process manager**: Use `systemd`, `supervisord`, or PM2
2. **Multiple workers**: Run multiple worker processes for throughput
3. **Monitoring**: Set up alerts for DLQ entries
4. **Logging**: Ship logs to centralized logging system
5. **Metrics**: Track delivery success rates, latency, retry counts

### Example systemd service

```ini
[Unit]
Description=Webhook Delivery Worker
After=network.target postgresql.service

[Service]
Type=simple
User=webhook
WorkingDirectory=/path/to/backendpy
ExecStart=/path/to/backendpy/venv/bin/python3 webhook_delivery_worker.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## API Integration

The worker automatically processes deliveries created by the event publishing API. No manual intervention needed - just publish events and the worker handles the rest!
