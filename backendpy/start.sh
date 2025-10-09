#!/bin/bash

# Startup script for Python backend (without Docker)
# Usage: ./start.sh

set -e  # Exit on error

echo "======================================================================="
echo "Python Webhook Backend - Startup Script"
echo "======================================================================="

# Change to script directory
cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "✓ Virtual environment created"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Check if requirements.txt exists and install dependencies
if [ -f "requirements.txt" ]; then
    echo "Installing/updating dependencies..."
    pip install -q -r requirements.txt
    echo "✓ Dependencies installed"
else
    echo "⚠ Warning: requirements.txt not found"
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠ Warning: .env file not found"
    echo "Please create .env file with required configuration"
    exit 1
fi

# Display configuration
echo ""
echo "Configuration:"
echo "  - Database: $(grep DATABASE_HOST .env | cut -d '=' -f2):$(grep DATABASE_PORT .env | cut -d '=' -f2)"
echo "  - Kafka: $(grep KAFKA_ENABLED .env | cut -d '=' -f2) ($(grep KAFKA_BROKERS .env | cut -d '=' -f2))"
echo ""

# Check if port 3005 is already in use
if lsof -Pi :3005 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠ Port 3005 is already in use. Killing existing process..."
    lsof -ti:3005 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

echo "======================================================================="
echo "Starting Python backend server on http://localhost:3005"
echo "Press Ctrl+C to stop"
echo "======================================================================="
echo ""

# Start the server
python3 local_server.py
