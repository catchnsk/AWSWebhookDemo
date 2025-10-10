1#!/bin/bash

# Webhook Delivery Worker Startup Script
# Usage: ./start-worker.sh

set -e

echo "======================================================================"
echo "Webhook Delivery Worker - Startup"
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

echo "Starting webhook delivery worker..."
echo ""

# Run the worker
python3 webhook_delivery_worker.py
