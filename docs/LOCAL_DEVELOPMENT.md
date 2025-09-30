# Local Development Guide

This guide will help you set up and run the Webhook Management System on your local machine for development and testing.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker Desktop** 4.0+ ([Download](https://www.docker.com/products/docker-desktop))
- **Node.js** 20+ ([Download](https://nodejs.org/))
- **npm** 10+ (comes with Node.js)
- **Git** (for cloning the repository)

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository (if not already done)
cd FAMILY-ACTIVITY-DEMO

# Copy environment file
cp .env.local .env

# Make setup script executable
chmod +x scripts/setup-local.sh

# Run setup script
./scripts/setup-local.sh
```

The setup script will:
- ✅ Start Docker containers (PostgreSQL, Kafka, Zookeeper)
- ✅ Create required Kafka topics
- ✅ Run database migrations automatically
- ✅ Install all npm dependencies
- ✅ Build the backend code

### 2. Start the Services

Open **3 terminal windows** and run:

**Terminal 1 - API Server:**
```bash
cd backend
npm run dev:api
```
This starts the REST API server on http://localhost:3000

**Terminal 2 - Delivery Consumer:**
```bash
cd backend
npm run dev:consumer
```
This consumes messages from the `delivery-messages` Kafka topic

**Terminal 3 - Retry Consumer:**
```bash
cd backend
npm run dev:retry
```
This consumes messages from the `retry-messages` Kafka topic

### 3. Verify Setup

Check if everything is running:

```bash
# Test API health
curl http://localhost:3000/health

# Expected response:
# {"status":"healthy","timestamp":"2024-...","environment":"development"}
```

## Architecture Overview

```
┌─────────────────┐
│   REST API      │  http://localhost:3000
│  (Express App)  │  - Producer Onboarding
└────────┬────────┘  - Schema Registration
         │           - Subscription Management
         │           - Event Publishing
         ▼
┌─────────────────┐
│   PostgreSQL    │  localhost:5432
│   (Database)    │  - Producers, Schemas
└────────┬────────┘  - Subscriptions, Events
         │           - Delivery Logs
         │
         ▼
┌─────────────────┐
│     Kafka       │  localhost:9092
│ (Message Queue) │  - delivery-messages
└────────┬────────┘  - retry-messages
         │           - dlq-messages
         │           - status-notifications
         ▼
┌─────────────────┐
│   Consumers     │  Background processes
│   (Workers)     │  - Delivery Consumer
└─────────────────┘  - Retry Consumer
```

## Testing the Complete Flow

### Step 1: Onboard a Producer

```bash
curl -X POST http://localhost:3000/api/v1/producers/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Order Service",
    "contactEmail": "orders@example.com",
    "contactName": "John Doe",
    "department": "Engineering"
  }'
```

**Response:**
```json
{
  "producer": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Order Service",
    "contactEmail": "orders@example.com",
    "status": "active"
  },
  "apiKey": "wh_prod_abc123xyz...",
  "message": "Producer onboarded successfully"
}
```

**⚠️ IMPORTANT:** Save the `apiKey` - it's shown only once!

### Step 2: Register a Schema

```bash
curl -X POST http://localhost:3000/api/v1/schemas/register \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wh_prod_abc123xyz..." \
  -d '{
    "name": "order-created",
    "eventType": "order.created",
    "version": "1.0.0",
    "schemaFormat": "json",
    "schemaDefinition": {
      "type": "object",
      "properties": {
        "orderId": {"type": "string"},
        "customerId": {"type": "string"},
        "amount": {"type": "number"},
        "status": {"type": "string"}
      },
      "required": ["orderId", "customerId", "amount"]
    },
    "description": "Emitted when a new order is created",
    "isPublic": true
  }'
```

**Response:**
```json
{
  "schema": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "name": "order-created",
    "eventType": "order.created",
    "version": "1.0.0",
    "status": "active"
  }
}
```

### Step 3: Partner Subscribes

First, onboard a subscriber (same as producer onboarding):

```bash
curl -X POST http://localhost:3000/api/v1/producers/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Shipping Partner",
    "contactEmail": "webhooks@shipping.com",
    "contactName": "Jane Smith",
    "department": "Integrations"
  }'
```

Then create a subscription:

```bash
curl -X POST http://localhost:3000/api/v1/subscriptions/subscribe \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wh_sub_xyz..." \
  -d '{
    "schemaId": "660e8400-e29b-41d4-a716-446655440000",
    "webhookUrl": "https://webhook.site/your-unique-url",
    "maxRetries": 3,
    "backoffStrategy": "exponential"
  }'
```

**💡 Tip:** Use [webhook.site](https://webhook.site) to get a test webhook URL!

### Step 4: Publish an Event

```bash
curl -X POST http://localhost:3000/api/v1/events/publish \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wh_prod_abc123xyz..." \
  -d '{
    "eventType": "order.created",
    "payload": {
      "orderId": "ORD-12345",
      "customerId": "CUST-67890",
      "amount": 99.99,
      "status": "pending"
    },
    "idempotencyKey": "unique-event-id-123"
  }'
```

**Response:**
```json
{
  "eventId": "evt_abc123...",
  "subscriberCount": 1,
  "deliveriesQueued": 1,
  "message": "Event published successfully"
}
```

### Step 5: Monitor Delivery

Watch the consumer terminal windows to see:

1. **Delivery Consumer** receives the message
2. Attempts webhook delivery to subscriber's URL
3. If delivery fails, publishes to retry queue
4. **Retry Consumer** processes retries with exponential backoff

Check delivery status:

```bash
curl -X GET http://localhost:3000/api/v1/subscriptions \
  -H "X-API-Key: wh_sub_xyz..."
```

## Management UIs

### Kafka UI
- **URL:** http://localhost:8080
- **Purpose:** Monitor Kafka topics, messages, consumer groups

### pgAdmin
- **URL:** http://localhost:5050
- **Email:** admin@webhook.local
- **Password:** admin
- **Purpose:** Query database, view delivery logs

**To connect to PostgreSQL in pgAdmin:**
1. Add New Server
2. Name: `Webhook DB`
3. Host: `postgres` (container name)
4. Port: `5432`
5. Database: `webhook_db`
6. Username: `webhook_user`
7. Password: `webhook_password`

## Environment Variables

The `.env` file contains local configuration. Key variables:

```bash
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=webhook_db
DATABASE_USER=webhook_user
DATABASE_PASSWORD=webhook_password

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC_EVENTS=delivery-messages
KAFKA_TOPIC_RETRY=retry-messages

# Feature Flags (for local dev)
SKIP_SCHEMA_REGISTRY=true    # Skip AWS Glue validation
SKIP_EMAIL_SENDING=true      # Log emails instead of sending
```

## Troubleshooting

### PostgreSQL won't start

```bash
# Stop all containers
docker-compose down -v

# Remove volumes
docker volume prune

# Start again
./scripts/setup-local.sh
```

### Kafka topics not created

```bash
# Manually create topics
docker-compose exec kafka kafka-topics --create \
  --bootstrap-server localhost:29092 \
  --topic delivery-messages \
  --partitions 3 \
  --replication-factor 1
```

### Can't connect to database

```bash
# Check if PostgreSQL is running
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres

# Test connection
psql -h localhost -p 5432 -U webhook_user -d webhook_db
```

### Consumer not receiving messages

```bash
# Check consumer group status
docker-compose exec kafka kafka-consumer-groups \
  --bootstrap-server localhost:29092 \
  --describe \
  --group webhook-consumers-local
```

## Database Migrations

Migrations run automatically when Docker starts. To run manually:

```bash
# Connect to PostgreSQL
psql -h localhost -p 5432 -U webhook_user -d webhook_db

# Run migration files
\i database/migrations/001_initial_schema.sql
\i database/migrations/002_enhanced_schema.sql
```

## Cleanup

### Stop Services (Keep Data)

```bash
docker-compose down
```

### Complete Reset (Remove Data)

```bash
# Stop and remove volumes
docker-compose down -v

# Clean npm modules
cd backend && rm -rf node_modules
```

## API Documentation

Full API documentation available at: [API_SPECIFICATION.md](./API_SPECIFICATION.md)

### Available Endpoints

```
POST   /api/v1/producers/onboard           - Onboard producer
POST   /api/v1/schemas/register            - Register schema
GET    /api/v1/schemas                     - List your schemas
GET    /api/v1/schemas/marketplace         - Browse public schemas
POST   /api/v1/subscriptions/subscribe     - Subscribe to schema
GET    /api/v1/subscriptions               - List subscriptions
POST   /api/v1/events/publish              - Publish event
GET    /health                             - Health check
```

## Development Tips

### Watch Mode

For faster development, use watch mode:

```bash
# Terminal 1 - API with auto-reload
cd backend
npx nodemon --watch shared --watch lambda --exec "npm run dev:api"
```

### Testing Retry Logic

Simulate failures by using an invalid webhook URL:

```json
{
  "webhookUrl": "http://httpstat.us/500"  // Always returns 500
}
```

Watch the retry consumer handle the retries!

### Query Delivery Logs

```sql
-- Connect to database
psql -h localhost -p 5432 -U webhook_user -d webhook_db

-- View recent deliveries
SELECT delivery_id, status, error_message, latency_ms, created_at
FROM delivery_logs
ORDER BY created_at DESC
LIMIT 10;

-- View retry attempts
SELECT delivery_id, status, retry_attempt, next_retry_at
FROM delivery_logs
WHERE status = 'retrying'
ORDER BY next_retry_at;

-- View dead letter queue
SELECT * FROM delivery_dlq ORDER BY moved_to_dlq_at DESC;
```

## Next Steps

- ✅ System is running locally
- 📚 Read [ARCHITECTURE.md](./ENHANCED_ARCHITECTURE.md) for system design
- 🔐 Read [API_SPECIFICATION.md](./API_SPECIFICATION.md) for all endpoints
- 🚀 Deploy to AWS (coming soon: deployment guide)

## Support

If you encounter issues:
1. Check Docker logs: `docker-compose logs`
2. Check API logs in the terminal
3. Check Kafka UI: http://localhost:8080
4. Query database via pgAdmin: http://localhost:5050
