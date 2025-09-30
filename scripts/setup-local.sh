#!/bin/bash

# Local Development Setup Script for Webhook Management System

set -e

echo "🚀 Setting up Local Development Environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Copy environment file
echo "📝 Setting up environment variables..."
if [ ! -f .env ]; then
    cp .env.local .env
    echo "✅ Created .env file from .env.local"
else
    echo "⚠️  .env file already exists, skipping..."
fi

# Start Docker containers
echo "🐳 Starting Docker containers (PostgreSQL, Kafka, Zookeeper)..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U webhook_user -d webhook_db > /dev/null 2>&1; do
    echo "   Waiting for PostgreSQL..."
    sleep 2
done
echo "✅ PostgreSQL is ready"

# Wait for Kafka to be ready
echo "⏳ Waiting for Kafka to be ready..."
sleep 10
echo "✅ Kafka is ready"

# Create Kafka topics
echo "📨 Creating Kafka topics..."
docker-compose exec -T kafka kafka-topics --create --if-not-exists --bootstrap-server localhost:29092 --topic delivery-messages --partitions 3 --replication-factor 1
docker-compose exec -T kafka kafka-topics --create --if-not-exists --bootstrap-server localhost:29092 --topic retry-messages --partitions 3 --replication-factor 1
docker-compose exec -T kafka kafka-topics --create --if-not-exists --bootstrap-server localhost:29092 --topic dlq-messages --partitions 1 --replication-factor 1
docker-compose exec -T kafka kafka-topics --create --if-not-exists --bootstrap-server localhost:29092 --topic status-notifications --partitions 1 --replication-factor 1
echo "✅ Kafka topics created"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

# Build backend
echo "🔨 Building backend..."
cd backend
npm run build
cd ..

echo ""
echo "✅ Local development environment is ready!"
echo ""
echo "🎉 Next steps:"
echo "   1. Access Kafka UI: http://localhost:8080"
echo "   2. Access pgAdmin: http://localhost:5050 (admin@webhook.local / admin)"
echo "   3. Test Lambda functions using the local server"
echo ""
echo "📚 Commands:"
echo "   npm run dev:api          - Start local API server"
echo "   npm run dev:consumer     - Start delivery consumer"
echo "   npm run dev:retry        - Start retry consumer"
echo "   npm run test:local       - Run integration tests"
echo ""
echo "🛑 To stop:"
echo "   docker-compose down      - Stop all containers"
echo "   docker-compose down -v   - Stop and remove volumes"
