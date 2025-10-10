import json
import os

# Flask app entrypoint exposed to AWS Lambda via awsgi

try:
    import awsgi  # type: ignore
except Exception as e:
    # Defer import error to runtime logs to avoid local dev failures
    awsgi = None  # type: ignore

from app import app


def handler(event, context):
    if awsgi is None:
        # Fallback simple response to indicate missing dependency in runtime
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'awsgi not available in runtime'})
        }
    return awsgi.response(app, event, context)


