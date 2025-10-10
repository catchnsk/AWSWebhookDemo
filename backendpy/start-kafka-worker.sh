#!/bin/bash

# Kafka Consumer-Based Webhook Delivery Worker Startup Script
# Usage: ./start-kafka-worker.sh

set -e

echo "======================================================================"
echo "Kafka Consumer-Based Webhook Delivery Worker - Startup"
echo "======================================================================"

# Change to script directory
cd "$(dirname "$0")"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found"
    exit 1
fi

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
fi

echo "Starting Kafka consumer worker..."
echo ""

# Run the Kafka worker
python3 kafka_delivery_worker.py
