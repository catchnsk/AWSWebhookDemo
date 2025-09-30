# Enhanced Webhook Management System - Architecture Document

## Overview

This document describes the enhanced architecture that implements a complete **Event-Driven Subscription Platform** with Schema Registry integration, producer/subscriber model, and comprehensive delivery management.

---

## 🏗️ Enhanced Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PRODUCER ONBOARDING                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Producer API    │─────▶│  Schema Admin    │─────▶│ Schema Registry  │
│  (Onboarding)    │      │  API (Lambda)    │      │  (AWS Glue/      │
└──────────────────┘      └──────────────────┘      │  Confluent)      │
                                    │                └──────────────────┘
                                    ▼
                          ┌──────────────────┐
                          │  Webhook DB      │
                          │  (PostgreSQL)    │
                          └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        PARTNER SUBSCRIPTION                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Partner Portal  │─────▶│  Subscription    │─────▶│  Webhook DB      │
│  (API Exchange)  │      │  Admin API       │      │  (subscriptions) │
└──────────────────┘      │  (Lambda)        │      └──────────────────┘
                          └──────────────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │  Email Service   │
                          │  (SES/SNS)       │
                          └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        EVENT PUBLISHING FLOW                             │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ Internal System  │─────▶│  Event Publisher │─────▶│  Webhook DB      │
│ (Posts Event)    │      │  API (Lambda)    │      │  (Fetch Schema & │
└──────────────────┘      └──────────────────┘      │   Subscriptions) │
                                    │                └──────────────────┘
                                    │                         │
                                    ▼                         ▼
                          ┌──────────────────┐      ┌──────────────────┐
                          │ Schema Registry  │      │ Validate Payload │
                          │ (Fetch Schema)   │◀─────│ against Schema   │
                          └──────────────────┘      └──────────────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │ Delivery Message │
                          │ Store (Kafka:    │
                          │ delivery-topic)  │
                          └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          DELIVERY PROCESS                                │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ Delivery Message │─────▶│  Delivery        │─────▶│  Egress Gateway  │
│ Store (Kafka)    │      │  Consumer        │      │  (HTTP Client)   │
└──────────────────┘      │  (Lambda)        │      └──────────────────┘
                          └──────────────────┘               │
                                    │                        │
                                    │                        ▼
                                    │              ┌──────────────────┐
                                    │              │  Partner         │
                                    │              │  Webhook URL     │
                                    │              └──────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          │                   │
                    Success                Failure
                          │                   │
                          ▼                   ▼
                 ┌──────────────────┐  ┌──────────────────┐
                 │ Update DB:       │  │ Retry Message    │
                 │ status=success   │  │ Store (Kafka:    │
                 └──────────────────┘  │ retry-topic)     │
                                       └──────────────────┘
                                                │
                                                ▼
                                       ┌──────────────────┐
                                       │ Delivery Status  │
                                       │ Checker (Lambda) │
                                       │ (Notifications)  │
                                       └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        DELIVERY RETRY PROCESS                            │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ Retry Message    │─────▶│  Delivery Retry  │─────▶│  Delivery        │
│ Store (Kafka)    │      │  Consumer        │      │  Message Store   │
└──────────────────┘      │  (Lambda)        │      │  (Re-publish)    │
                          └──────────────────┘      └──────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          │                   │
                    Max Retries           Still Failing
                    Reached                   │
                          │                   ▼
                          ▼          ┌──────────────────┐
                 ┌──────────────────┐│ Delivery Status  │
                 │ Update DB:       ││ Checker (Lambda) │
                 │ status=failed    ││ (Send Failed     │
                 │ Move to DLQ      ││  Notification)   │
                 └──────────────────┘└──────────────────┘
```

---

## 🎯 Core Components

### 1. Producer Onboarding System

**Purpose**: Allow internal producers to register event schemas

**Components**:
- **Producer Onboarding API** (`/producers/onboard`)
- **Schema Admin API** (`/schemas/register`)
- **Schema Registry** (AWS Glue Schema Registry or Confluent)
- **Webhook Database** (producer & schema metadata)

**Flow**:
1. Producer registers via onboarding API
2. Producer publishes schema definition (Avro/JSON Schema)
3. Schema Admin API validates schema
4. Schema is registered in Schema Registry
5. Schema metadata stored in Webhook DB
6. Producer receives schema ID and API credentials

---

### 2. Partner Subscription System

**Purpose**: Enable partners to subscribe to event schemas via API Exchange

**Components**:
- **API Exchange Portal** (Web UI for partners)
- **Subscription Admin API** (`/subscriptions/subscribe`)
- **Email Notification Service** (AWS SES/SNS)
- **Webhook Database** (subscription records)

**Flow**:
1. Partner browses available schemas in API Exchange
2. Partner subscribes to a schema
3. Subscription Admin API validates and creates subscription
4. Subscription details stored in Webhook DB
5. Confirmation email sent to partner
6. Partner receives webhook URL configuration guide

---

### 3. Event Publishing Flow

**Purpose**: Internal systems publish events that trigger subscriber webhooks

**Components**:
- **Event Publisher API** (`/events/publish`)
- **Schema Registry** (for validation)
- **Webhook Database** (subscription lookup)
- **Delivery Message Store** (Kafka topic: `delivery-messages`)

**Flow**:
1. Internal system posts event message to Event Publisher API
2. API fetches event schema from Schema Registry
3. API fetches all subscriptions for this event type from Webhook DB
4. Payload validated against schema
5. For each subscription, publish message to Delivery Message Store
6. Return acknowledgment to internal system

---

### 4. Delivery Process

**Purpose**: Consume messages and deliver to partner webhook URLs

**Components**:
- **Delivery Consumer** (Kafka consumer Lambda)
- **Egress Gateway** (HTTP client with retry logic)
- **Webhook Database** (delivery status updates)
- **Retry Message Store** (Kafka topic: `retry-messages`)
- **Delivery Status Checker** (notification system)

**Flow**:
1. Delivery Consumer reads from Delivery Message Store
2. Fetch subscription/webhook details from Webhook DB
3. Send HTTP request via Egress Gateway to partner URL
4. **If Success**:
   - Update delivery status in Webhook DB (status=success)
   - Commit Kafka offset
5. **If Failure**:
   - Publish to Retry Message Store with retry metadata
   - Update delivery status in Webhook DB (status=retrying)
   - Notify Delivery Status Checker

---

### 5. Delivery Retry Process

**Purpose**: Handle failed deliveries with exponential backoff

**Components**:
- **Delivery Retry Consumer** (Kafka consumer Lambda)
- **Retry Message Store** (Kafka topic: `retry-messages`)
- **Delivery Message Store** (re-publish on retry)
- **Delivery Status Checker** (notification system)
- **Webhook Database** (update failed status)

**Flow**:
1. Retry Consumer reads from Retry Message Store
2. Check retry count and backoff delay
3. **If within retry limit**:
   - Re-publish to Delivery Message Store (incremented retry count)
4. **If max retries reached**:
   - Update Webhook DB (status=failed)
   - Move to Dead Letter Queue
   - Notify Delivery Status Checker for alert
   - Send failure notification to partner

---

### 6. Delivery Status Checker System

**Purpose**: Monitor delivery health and send notifications

**Components**:
- **Status Checker Lambda** (scheduled)
- **SNS/SES** (email notifications)
- **Webhook Database** (query failed deliveries)
- **CloudWatch Alarms**

**Flow**:
1. Triggered by failed delivery events
2. Query Webhook DB for delivery status
3. Aggregate failure patterns
4. Send notifications:
   - Partner notification (webhook endpoint down)
   - Admin notification (high failure rate)
5. Create CloudWatch alarms

---

## 📊 Enhanced Database Schema

### New Tables

#### `producers`
```sql
CREATE TABLE producers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `schemas` (Enhanced)
```sql
CREATE TABLE schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producer_id UUID REFERENCES producers(id),
    schema_registry_id VARCHAR(255) UNIQUE, -- AWS Glue or Confluent ID
    name VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL UNIQUE,
    version VARCHAR(50) NOT NULL,
    schema_format VARCHAR(50) DEFAULT 'json', -- json, avro, protobuf
    schema_definition JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    subscription_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `subscribers` (Partners)
```sql
CREATE TABLE subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    email VARCHAR(255) NOT NULL UNIQUE,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    webhook_url VARCHAR(2048) NOT NULL,
    webhook_secret VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `subscriptions`
```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID REFERENCES subscribers(id),
    schema_id UUID REFERENCES schemas(id),
    webhook_url VARCHAR(2048) NOT NULL,
    auth_type VARCHAR(50) DEFAULT 'none',
    auth_config JSONB,
    custom_headers JSONB,
    enabled BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'active',

    -- Delivery Configuration
    max_retries INTEGER DEFAULT 3,
    backoff_strategy VARCHAR(50) DEFAULT 'exponential',
    initial_delay_ms INTEGER DEFAULT 1000,
    timeout_ms INTEGER DEFAULT 30000,

    -- Statistics
    total_deliveries BIGINT DEFAULT 0,
    successful_deliveries BIGINT DEFAULT 0,
    failed_deliveries BIGINT DEFAULT 0,
    avg_latency_ms INTEGER DEFAULT 0,
    last_delivery_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(subscriber_id, schema_id)
);
```

#### `event_messages`
```sql
CREATE TABLE event_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    producer_id UUID REFERENCES producers(id),
    schema_id UUID REFERENCES schemas(id),
    event_type VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subscriber_count INTEGER DEFAULT 0
);
```

#### `delivery_logs` (Replaces webhook_executions)
```sql
CREATE TABLE delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id VARCHAR(255) UNIQUE NOT NULL,
    event_id VARCHAR(255) REFERENCES event_messages(event_id),
    subscription_id UUID REFERENCES subscriptions(id),
    subscriber_id UUID REFERENCES subscribers(id),

    -- Request Details
    request_url VARCHAR(2048) NOT NULL,
    request_method VARCHAR(10) DEFAULT 'POST',
    request_headers JSONB,
    request_payload JSONB,

    -- Response Details
    response_status_code INTEGER,
    response_headers JSONB,
    response_body TEXT,

    -- Delivery Metadata
    status VARCHAR(50) NOT NULL, -- queued, delivering, success, failed, retrying
    retry_attempt INTEGER DEFAULT 0,
    latency_ms INTEGER,
    error_message TEXT,
    error_code VARCHAR(100),

    -- Timestamps
    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    next_retry_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔄 Kafka Topics

### 1. `delivery-messages`
- **Purpose**: Primary delivery queue
- **Partitions**: 20
- **Retention**: 7 days
- **Producers**: Event Publisher API
- **Consumers**: Delivery Consumer

### 2. `retry-messages`
- **Purpose**: Failed deliveries for retry
- **Partitions**: 10
- **Retention**: 14 days
- **Producers**: Delivery Consumer (on failure)
- **Consumers**: Delivery Retry Consumer

### 3. `dlq-messages`
- **Purpose**: Dead letter queue for permanently failed messages
- **Partitions**: 5
- **Retention**: 30 days
- **Producers**: Delivery Retry Consumer (after max retries)
- **Consumers**: Manual investigation

### 4. `status-notifications`
- **Purpose**: Delivery status events for notification system
- **Partitions**: 5
- **Retention**: 3 days
- **Producers**: Delivery Consumer, Retry Consumer
- **Consumers**: Delivery Status Checker

---

## 🔌 API Endpoints

### Producer APIs

```
POST   /api/v1/producers/onboard          # Register producer
POST   /api/v1/schemas/register            # Register schema
GET    /api/v1/schemas                     # List schemas
GET    /api/v1/schemas/{schemaId}          # Get schema details
PUT    /api/v1/schemas/{schemaId}          # Update schema (new version)
```

### Subscriber APIs

```
POST   /api/v1/subscribers/register        # Register subscriber
GET    /api/v1/schemas/marketplace         # Browse available schemas
POST   /api/v1/subscriptions/subscribe     # Subscribe to schema
GET    /api/v1/subscriptions                # List my subscriptions
DELETE /api/v1/subscriptions/{subId}       # Unsubscribe
```

### Event Publishing APIs

```
POST   /api/v1/events/publish              # Publish event (internal systems)
GET    /api/v1/events/{eventId}/status     # Get event delivery status
```

### Admin/Monitoring APIs

```
GET    /api/v1/deliveries                  # List delivery logs
GET    /api/v1/deliveries/{deliveryId}     # Get delivery details
POST   /api/v1/deliveries/{deliveryId}/retry # Manually retry
GET    /api/v1/analytics/dashboard         # Delivery analytics
```

---

## 🔐 Security

### Producer Security
- API Key authentication
- Schema validation before publishing
- Rate limiting per producer

### Subscriber Security
- Webhook signature (HMAC-SHA256)
- mTLS support (optional)
- IP whitelisting (optional)

### Schema Registry Security
- Schema versioning with backward compatibility checks
- Access control per producer
- Schema encryption at rest

---

## 📈 Success Metrics

| Metric | Target |
|--------|--------|
| Event Publishing Latency | < 100ms P95 |
| Delivery Latency | < 500ms P95 |
| Delivery Success Rate | > 99.5% |
| Schema Validation Time | < 50ms |
| Retry Success Rate | > 80% |
| System Availability | 99.99% |

---

## 🚀 Migration Path

### Phase 1: Schema Registry Integration
1. Set up AWS Glue Schema Registry
2. Implement Schema Admin API
3. Migrate existing webhook schemas

### Phase 2: Producer/Subscriber Model
1. Create producers and subscribers tables
2. Build onboarding APIs
3. Migrate existing webhooks to subscriptions

### Phase 3: Enhanced Delivery Pipeline
1. Implement Delivery Message Store
2. Build Delivery Consumer with Egress Gateway
3. Implement Retry Process

### Phase 4: Monitoring & Notifications
1. Build Delivery Status Checker
2. Integrate email notifications
3. Create CloudWatch dashboards

---

**This architecture provides a complete, production-ready event-driven subscription platform!**