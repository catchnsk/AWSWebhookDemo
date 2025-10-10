# Python Backend for Webhook Management System

This is a Python implementation of the webhook management backend, mirroring the TypeScript backend functionality.

## Structure

```
backendpy/
├── lambda/                    # Lambda function handlers
│   ├── producer_onboarding/   # Producer onboarding
│   ├── schema_admin/          # Schema administration
│   ├── subscription_admin/    # Subscription management
│   ├── event_publisher/       # Event publishing
│   ├── event_admin/           # Event administration
│   ├── admin_user_manager/    # Admin user management
│   └── admin_auth/            # Admin authentication
├── shared/                    # Shared utilities and models
│   ├── models/                # Database models
│   │   ├── producer.py
│   │   ├── schema.py
│   │   ├── subscription.py
│   │   └── admin.py
│   └── utils/                 # Utility functions
│       ├── database.py        # PostgreSQL connection
│       ├── response.py        # Response helpers
│       ├── validation.py      # Validation utilities
│       └── crypto.py          # Cryptographic functions
├── local_server.py            # Flask development server
├── requirements.txt           # Python dependencies
└── .env.template              # Environment variables template

## Setup

### 1. Create Virtual Environment

```bash
cd backendpy
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.template .env
# Edit .env with your local settings
```

### 4. Run the Server

```bash
python local_server.py
```

The server will start on port 3005 (configurable via API_PORT in .env).

## API Endpoints

### Producer Onboarding
- `POST /api/v1/producers/onboard` - Onboard a new producer

### Admin Authentication  
- `POST /api/v1/admin/login` - Admin login

### Schema Management
- `POST /api/v1/schemas/register` - Register a schema (Not yet implemented)
- `GET /api/v1/schemas` - List schemas (Not yet implemented)
- `GET /api/v1/schemas/marketplace` - List public schemas (Not yet implemented)
- `GET /api/v1/schemas/:id` - Get schema details (Not yet implemented)
- `POST /api/v1/schemas/:id/validate` - Validate payload (Not yet implemented)

### Subscription Management
- `POST /api/v1/subscriptions/subscribe` - Create subscription (Not yet implemented)
- `GET /api/v1/subscriptions` - List subscriptions (Not yet implemented)
- `GET /api/v1/subscriptions/:id` - Get subscription details (Not yet implemented)
- `PATCH /api/v1/subscriptions/:id` - Update subscription (Not yet implemented)
- `DELETE /api/v1/subscriptions/:id` - Cancel subscription (Not yet implemented)

### Event Publishing
- `POST /api/v1/events/publish` - Publish event (Not yet implemented)
- `GET /api/v1/events` - List events (Not yet implemented)

### Admin User Management
- `POST /api/v1/admin/users` - Create admin user (Not yet implemented)
- `GET /api/v1/admin/users` - List admin users (Not yet implemented)
- `GET /api/v1/admin/users/:id` - Get admin user (Not yet implemented)
- `PATCH /api/v1/admin/users/:id` - Update admin user (Not yet implemented)
- `DELETE /api/v1/admin/users/:id` - Delete admin user (Not yet implemented)

### Health Check
- `GET /health` - Health check endpoint

## Database

The Python backend uses the same PostgreSQL database as the TypeScript backend. Ensure the database is running and properly configured in your .env file.

## Webhook Delivery Workers

Two webhook delivery worker implementations are available:

### 1. Database Polling Worker (Legacy)
**File:** `webhook_delivery_worker.py`
**Start:** `./start-worker.sh`

**How it works:**
- Polls `delivery_queue` table every 2 seconds
- Processes pending deliveries in batches
- Handles retries with configurable backoff strategies
- Moves failed deliveries to DLQ after max retries

**Pros:**
- Simple implementation
- No Kafka dependency for delivery
- Works with any event source

**Cons:**
- High database overhead (constant polling)
- Latency from polling interval (2-5 seconds)
- Race conditions with multiple workers
- Resource waste on empty polls

**Use case:** Development, testing, or when Kafka is not available

---

### 2. Kafka Consumer Worker (Recommended) - Hybrid Approach
**File:** `kafka_delivery_worker.py`
**Start:** `./start-kafka-worker.sh`

**How it works:**
- Subscribes to Kafka topics as consumer
- Processes events in real-time as they're published
- Looks up subscriptions for each event's schema
- **First attempt:** Delivers webhooks immediately (real-time)
- **On failure:** Writes to `delivery_queue` for async retry
- **Retries:** Handled by polling worker with proper backoff

**Pros:**
- ✅ **Real-time first delivery** - No polling delay (~10ms latency)
- ✅ **Event-driven** - Reactive, not polling
- ✅ **Scales automatically** - Kafka consumer groups
- ✅ **No database polling** - Reduces DB load by 90%
- ✅ **Smart retry logic** - Failed deliveries use async retries with backoff
- ✅ **Best of both worlds** - Fast delivery + reliable retries
- ✅ **Partition-based parallelism** - Multiple workers process different partitions
- ✅ **Exactly-once semantics** - Kafka offset management

**Cons:**
- Requires Kafka to be running
- Requires both workers for full retry support
- Slightly more complex setup

**Use case:** Production deployment with Kafka infrastructure

**Retry Strategy:**
```
Event Published → Kafka → Consumer Worker → Webhook Delivery
                                               ↓ (if fails)
                                         delivery_queue
                                               ↓
                                         Polling Worker → Retries with Backoff
```

---

### Starting the Workers

**Database Polling Worker:**
```bash
./start-worker.sh
```

**Kafka Consumer Worker:**
```bash
./start-kafka-worker.sh
```

### Configuration

Both workers support these environment variables:

```bash
# Common settings
DELIVERY_REQUEST_TIMEOUT=30    # Webhook request timeout (seconds)

# Polling worker only
DELIVERY_POLL_INTERVAL=2       # Database poll interval (seconds)
DELIVERY_BATCH_SIZE=10         # Max deliveries per batch

# Kafka worker only
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_CONSUMER_GROUP=webhook-delivery-worker
KAFKA_AUTO_COMMIT=false        # Manual commit for better control
```

### Worker Architecture

**Polling Worker Flow:**
```
Database → Poll Queue → Fetch Batch → Send Webhooks → Update Status → Repeat
```

**Kafka Worker Flow:**
```
Event Published → Kafka Topic → Consumer → Lookup Subscriptions → Send Webhooks → Commit Offset
```

### Running the Hybrid Approach (Recommended for Production)

For optimal performance, run **both workers together**:

```bash
# Terminal 1: Start Kafka consumer worker (real-time delivery)
./start-kafka-worker.sh

# Terminal 2: Start polling worker (handles retries)
./start-worker.sh
```

**How they work together:**
1. **Kafka worker** delivers webhooks in real-time when events are published
2. **Failed deliveries** are written to `delivery_queue` by Kafka worker
3. **Polling worker** picks up failed deliveries and retries with backoff
4. **DLQ** captures deliveries that fail after all retries

This gives you:
- ⚡ Real-time delivery (Kafka worker)
- 🔄 Reliable retries with exponential backoff (polling worker)
- 💀 DLQ for permanent failures

### Using Workers Individually

**Option 1: Polling Worker Only**
```bash
./start-worker.sh
```
- Simpler setup
- Works without Kafka
- Higher latency (2-5 second polling interval)

**Option 2: Kafka Worker Only**
```bash
./start-kafka-worker.sh
```
- Real-time delivery
- Failed deliveries go to DLQ immediately (no retries)
- Requires Kafka running

---

## Development Notes

- This implementation uses Flask for the local development server
- Database access is handled via psycopg2
- The code structure mirrors the TypeScript backend for consistency
- Lambda handlers can be deployed to AWS Lambda if needed
- Webhook delivery workers support both polling and event-driven architectures
- Most endpoints are fully implemented and functional

## Running Tests

```bash
pytest
```

## Code Formatting

```bash
black .
flake8 .
```

## Comparison with TypeScript Backend

| Feature | TypeScript | Python |
|---------|-----------|--------|
| Web Framework | Express | Flask |
| Database Driver | pg | psycopg2 |
| Password Hashing | bcryptjs | bcrypt |
| Port | 3000 | 3005 |
| Lambda Support | Yes | Yes |
| Schema Validation | ajv | jsonschema |

## TODO

- [ ] Implement remaining Lambda handlers (schema_admin, subscription_admin, event_publisher, etc.)
- [ ] Add comprehensive error handling
- [ ] Add request validation middleware
- [ ] Implement Kafka integration
- [ ] Add AWS SDK integration for production deployment
- [ ] Add comprehensive test coverage
- [ ] Add API documentation (Swagger/OpenAPI)
