#!/usr/bin/env python3
"""
Test script to verify Kafka event publishing works
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

print("=" * 70)
print("Testing Kafka Event Publishing")
print("=" * 70)

# Import the publish_event function
from shared.models.event import publish_event
from shared.models.schema import list_schemas

# Get schemas to find one to publish to
schemas = list_schemas(page=1, limit=10)
print(f"\nFound {schemas['total']} schemas in database")

if schemas['total'] == 0:
    print("No schemas found! Please create a schema first.")
    sys.exit(1)

# Use the first schema
schema = schemas['schemas'][0]
print(f"\nUsing schema: {schema['name']} (ID: {schema['id']})")
print(f"Event type: {schema['event_type']}")
print(f"Producer ID: {schema['producer_id']}")

# Create test payload
test_payload = {
    "test_field": "test_value",
    "timestamp": "2025-01-07T23:50:00Z"
}

print(f"\nPublishing test event...")
print(f"Payload: {test_payload}")

# Publish the event
result = publish_event(
    producer_id=schema['producer_id'],
    schema_id=schema['id'],
    event_type=schema['event_type'],
    payload=test_payload
)

print(f"\nPublish result:")
print(f"Event ID: {result.get('event_id') if result else 'None'}")
print(f"Subscriber count: {result.get('subscriber_count') if result else '0'}")
print(f"Deliveries queued: {result.get('deliveries_queued') if result else '0'}")

print("\n" + "=" * 70)
print("Test completed!")
print("=" * 70)
