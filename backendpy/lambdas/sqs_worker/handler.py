import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from shared.utils.database import query, query_one
from webhook_delivery_worker import process_delivery


def handler(event, context):
    """SQS-triggered Lambda to process webhook deliveries.
    Expects SQS messages containing a delivery_id to fetch from DB,
    or an embedded delivery object in the body.
    """
    records = event.get('Records', []) or []
    successes = 0
    failures = 0

    for record in records:
        try:
            body = record.get('body')
            message = json.loads(body) if isinstance(body, str) else body

            # Support two formats: {"delivery_id": "..."} or full delivery object
            if isinstance(message, dict) and 'delivery_id' in message:
                delivery_id = message['delivery_id']
                sql = (
                    "SELECT id, delivery_id, event_id, subscription_id, subscriber_id, "
                    "webhook_url, payload, max_retries, backoff_strategy, status, attempt_count "
                    "FROM delivery_queue WHERE delivery_id = %s"
                )
                result = query_one(sql, (delivery_id,))
                if not result:
                    failures += 1
                    continue
                delivery = dict(result)
                should_remove = process_delivery(delivery)
                if should_remove:
                    successes += 1
                else:
                    successes += 1  # processed and scheduled for retry
            else:
                # Assume message is a delivery object
                if not isinstance(message, dict):
                    failures += 1
                    continue
                should_remove = process_delivery(message)
                successes += 1 if should_remove else 1
        except Exception:
            failures += 1

    # Lambda success regardless; detailed failures go to CloudWatch and SQS retry/DLQ handles reprocessing
    return {
        'statusCode': 200,
        'body': json.dumps({'processed': len(records), 'successes': successes, 'failures': failures})
    }


