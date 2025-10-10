"""
Webhook Listener Lambda - Test webhook endpoint
Logs all incoming webhook requests for testing/debugging
"""
import json
import os
import sys
from datetime import datetime

# Add parent directories to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from shared.utils.response import success_response, ErrorResponses, cors_preflight_response


def handler(event, context):
    """
    Lambda handler for webhook listener (test endpoint)
    Logs all incoming webhook requests
    """
    print("=" * 70)
    print(f"WEBHOOK LISTENER - Incoming Request at {datetime.utcnow().isoformat()}")
    print("=" * 70)

    # Handle CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return cors_preflight_response()

    try:
        # Extract request details
        http_method = event.get('httpMethod', 'UNKNOWN')
        path = event.get('path', '/unknown')
        headers = event.get('headers', {})
        query_params = event.get('queryStringParameters', {})

        # Parse body
        body = event.get('body')
        if body:
            try:
                if isinstance(body, str):
                    body_parsed = json.loads(body)
                else:
                    body_parsed = body
            except (json.JSONDecodeError, ValueError):
                body_parsed = body  # Keep as string if not valid JSON
        else:
            body_parsed = None

        # Log the request
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'method': http_method,
            'path': path,
            'headers': headers,
            'query_params': query_params,
            'body': body_parsed,
            'source_ip': headers.get('X-Forwarded-For', headers.get('X-Real-IP', 'unknown'))
        }

        # Print to CloudWatch Logs (or console in local dev)
        print(json.dumps(log_entry, indent=2))

        # Also write to a log file (for local testing)
        log_to_file(log_entry)

        # Verify HMAC signature if present
        signature_header = headers.get('X-Webhook-Signature') or headers.get('x-webhook-signature')
        if signature_header:
            print(f"\nWebhook Signature Received: {signature_header}")
            # In production, you would verify the signature here
            # For testing, we just log it

        print("=" * 70)
        print("Request logged successfully!")
        print("=" * 70)

        # Return success response
        return success_response({
            'message': 'Webhook received and logged successfully',
            'timestamp': log_entry['timestamp'],
            'logged': True
        })

    except Exception as error:
        print(f"Error processing webhook: {error}")
        import traceback
        traceback.print_exc()

        error_message = str(error) if os.environ.get('NODE_ENV') == 'development' else 'Internal server error'
        return ErrorResponses.internal_server_error(error_message)


def log_to_file(log_entry):
    """
    Write log entry to file (for local development)
    In production, this would go to CloudWatch Logs automatically
    """
    try:
        log_dir = os.path.join(os.path.dirname(__file__), '../../logs')
        os.makedirs(log_dir, exist_ok=True)

        log_file = os.path.join(log_dir, 'webhook_listener.log')

        with open(log_file, 'a') as f:
            f.write(json.dumps(log_entry, indent=2))
            f.write('\n' + ('-' * 70) + '\n')

        print(f"Logged to file: {log_file}")
    except Exception as e:
        print(f"Failed to write to log file: {e}")
        # Don't fail the request if file logging fails
        pass


def verify_webhook_signature(payload, signature, secret):
    """
    Verify HMAC signature of webhook payload

    Args:
        payload: Request body (string)
        signature: Signature from X-Webhook-Signature header (e.g., "sha256=abc123...")
        secret: Webhook secret key

    Returns:
        Boolean indicating if signature is valid
    """
    import hmac
    import hashlib

    if not signature or not signature.startswith('sha256='):
        return False

    # Extract the hash from "sha256=<hash>"
    expected_signature = signature.replace('sha256=', '')

    # Compute HMAC
    computed_hmac = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    # Compare signatures (constant-time comparison to prevent timing attacks)
    return hmac.compare_digest(computed_hmac, expected_signature)
