# Requirements Mapping - Enhanced Webhook Management System

## Overview

This document maps your detailed requirements to the implementation components.

---

## ✅ Requirement 1: Message Schema Registration by Producers

### a. Onboarding Process

**Implementation**:
- **API Endpoint**: `POST /api/v1/producers/onboard`
- **Database Table**: `producers`
- **Lambda Function**: `producer-onboarding` (to be created)

**Flow**:
```
1. Producer fills onboarding form
2. Producer Onboarding API validates information
3. Generate API key for producer
4. Store producer details in `producers` table
5. Send welcome email with API credentials
6. Return API key to producer
```

**Database Record**:
```sql
INSERT INTO producers (name, description, contact_email, api_key, api_key_hash)
VALUES ('OrderService', 'Handles order events', 'orders@company.com', 'wh_prod_xxx', hash)
```

**Code Location**: `backend/lambda/producer-onboarding/index.ts`

---

### b. Publish the Schema

**Implementation**:
- **API Endpoint**: `POST /api/v1/schemas/register`
- **Database Table**: `schemas`
- **Lambda Function**: `schema-admin` (to be created)
- **External System**: AWS Glue Schema Registry or Confluent Schema Registry

**Flow**:
```
1. Producer submits schema definition (JSON Schema/Avro)
2. Schema Admin API validates schema format
3. Register schema in Schema Registry (AWS Glue)
4. Store schema metadata in `schemas` table
5. Return schema ID to producer
```

**Request Example**:
```json
POST /api/v1/schemas/register
Authorization: Bearer <producer_api_key>

{
  "name": "Order Created Event",
  "eventType": "order.created",
  "version": "1.0.0",
  "schemaFormat": "json",
  "schemaDefinition": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["orderId", "customerId", "amount"],
    "properties": {
      "orderId": { "type": "string" },
      "customerId": { "type": "string" },
      "amount": { "type": "number" }
    }
  },
  "isPublic": true
}
```

**Database Record**:
```sql
INSERT INTO schemas (producer_id, schema_registry_id, name, event_type, version, schema_definition)
VALUES (producer_uuid, 'arn:aws:glue:...', 'Order Created', 'order.created', '1.0.0', {schema})
```

**Code Location**: `backend/lambda/schema-admin/index.ts`

---

## ✅ Requirement 2: Schema Registration Admin API

### a. Register the schema in Webhook DB

**Implementation**: ✅ Covered above in Requirement 1b
- **Table**: `schemas`
- **Function**: Automatically happens during schema registration

---

### b. Register the schema in Schema Registry

**Implementation**:
- **Service**: AWS Glue Schema Registry integration
- **Utility**: `backend/shared/utils/schemaRegistry.ts`

**Code Example**:
```typescript
// backend/shared/utils/schemaRegistry.ts
import { GlueClient, CreateSchemaCommand } from '@aws-sdk/client-glue';

export async function registerSchemaInRegistry(
  schemaName: string,
  schemaDefinition: any,
  schemaFormat: 'json' | 'avro'
): Promise<string> {
  const client = new GlueClient({ region: process.env.AWS_REGION });

  const command = new CreateSchemaCommand({
    SchemaName: schemaName,
    DataFormat: schemaFormat.toUpperCase(),
    SchemaDefinition: JSON.stringify(schemaDefinition),
    RegistryId: {
      RegistryName: 'webhook-schema-registry'
    }
  });

  const response = await client.send(command);
  return response.SchemaArn!; // Store this as schema_registry_id
}
```

**Code Location**: `backend/shared/utils/schemaRegistry.ts`

---

## ✅ Requirement 3: Partner subscribes to a schema via API Exchange

**Implementation**:
- **Frontend**: API Exchange Portal (React app)
- **API Endpoint**: `POST /api/v1/subscriptions/subscribe`
- **Database Table**: `subscriptions`
- **Lambda Function**: `subscription-admin` (to be created)

**Flow**:
```
1. Partner browses schemas in API Exchange portal
   GET /api/v1/schemas/marketplace

2. Partner selects schema and clicks "Subscribe"

3. Partner provides webhook URL and configuration

4. Subscription Admin API creates subscription
   POST /api/v1/subscriptions/subscribe

5. Store subscription in `subscriptions` table

6. Return subscription confirmation
```

**Request Example**:
```json
POST /api/v1/subscriptions/subscribe
Authorization: Bearer <subscriber_api_key>

{
  "schemaId": "schema-uuid-123",
  "webhookUrl": "https://partner.com/webhooks/orders",
  "authType": "hmac",
  "maxRetries": 3,
  "backoffStrategy": "exponential"
}
```

**Database Record**:
```sql
INSERT INTO subscriptions (subscriber_id, schema_id, webhook_url, webhook_secret, enabled)
VALUES (subscriber_uuid, schema_uuid, 'https://partner.com/webhooks/orders', 'whsec_xxx', true)
```

**Code Location**: `backend/lambda/subscription-admin/index.ts`

---

## ✅ Requirement 4: Subscription Admin API

### a. Insert the schema subscription details in Webhook Database

**Implementation**: ✅ Covered above in Requirement 3
- **Table**: `subscriptions`
- **Automatic**: Happens during subscription creation

---

### b. Send the subscription information over email

**Implementation**:
- **Service**: AWS SES (Simple Email Service)
- **Database Table**: `notification_logs`
- **Lambda Function**: `notification-service` (to be created)
- **Utility**: `backend/shared/utils/email.ts`

**Flow**:
```
1. After subscription created, trigger notification
2. Notification Service Lambda sends email via SES
3. Email contains:
   - Schema details
   - Webhook URL
   - Authentication details (webhook secret)
   - Example payload
   - Documentation link
4. Log notification in `notification_logs` table
```

**Email Template**:
```
Subject: Your Subscription to "Order Created Event" is Active

Hi {{subscriber_name}},

Your subscription to the "Order Created Event" schema has been successfully activated!

Schema Details:
- Event Type: order.created
- Version: 1.0.0
- Your Webhook URL: https://partner.com/webhooks/orders

Authentication:
- Method: HMAC-SHA256
- Webhook Secret: whsec_xxx (keep this secure!)

Example Payload:
{
  "orderId": "order-123",
  "customerId": "cust-456",
  "amount": 99.99
}

To verify webhook signatures, use the secret provided above.

View full documentation: https://docs.webhooks.company.com/schemas/order.created

Thanks,
The Webhook Team
```

**Code Location**: `backend/lambda/notification-service/index.ts`

---

## ✅ Requirement 5: Internal Systems will post an event message

**Implementation**:
- **API Endpoint**: `POST /api/v1/events/publish`
- **Database Tables**: `event_messages`, `subscriptions`
- **Lambda Function**: `event-publisher` (to be created)
- **Kafka Topic**: `delivery-messages`

### a. Fetch event and subscription details from Webhook database

**Flow**:
```sql
-- Fetch schema
SELECT * FROM schemas WHERE event_type = 'order.created';

-- Fetch all active subscriptions for this schema
SELECT s.*, sub.webhook_url, sub.webhook_secret
FROM subscriptions s
JOIN subscribers sub ON sub.id = s.subscriber_id
WHERE s.schema_id = :schema_id
  AND s.enabled = true
  AND s.status = 'active';
```

---

### b. Get the schema from Schema Registry to validate the payload

**Implementation**:
```typescript
// Fetch schema from AWS Glue
const schema = await getSchemaFromRegistry(schemaRegistryId);

// Validate payload
const validation = validatePayload(eventPayload, schema);

if (!validation.valid) {
  return ErrorResponses.unprocessableEntity('Payload validation failed', validation.errors);
}
```

---

### c. Produce the message to send to Delivery message store

**Implementation**:
```typescript
// For each subscription, publish to Kafka
for (const subscription of subscriptions) {
  const deliveryMessage = {
    deliveryId: generateDeliveryId(),
    eventId: event.event_id,
    subscriptionId: subscription.id,
    subscriberId: subscription.subscriber_id,
    webhookUrl: subscription.webhook_url,
    webhookSecret: subscription.webhook_secret,
    payload: eventPayload,
    retryAttempt: 0,
    maxRetries: subscription.max_retries,
    backoffStrategy: subscription.backoff_strategy,
    timestamp: new Date().toISOString()
  };

  // Publish to Kafka delivery-messages topic
  await publishMessage('delivery-messages', deliveryMessage, deliveryMessage.deliveryId);

  // Create delivery log record
  await createDeliveryLog({
    delivery_id: deliveryMessage.deliveryId,
    event_id: event.event_id,
    subscription_id: subscription.id,
    status: 'queued'
  });
}
```

**Code Location**: `backend/lambda/event-publisher/index.ts`

---

## ✅ Requirement 6: The message will be consumed by the delivery process

**Implementation**:
- **Lambda Function**: `delivery-consumer` (to be created)
- **Kafka Topic**: `delivery-messages` (consumer)
- **Kafka Topic**: `retry-messages` (producer on failure)
- **Database Table**: `delivery_logs`

### a. If there is a failure, send to Retry message store

#### 1. Push retry delivery messages to delivery retry process

**Implementation**:
```typescript
// In delivery-consumer Lambda
try {
  // Send HTTP request to partner webhook
  const response = await egressGateway.sendWebhook({
    url: message.webhookUrl,
    payload: message.payload,
    secret: message.webhookSecret,
    timeout: subscription.timeout_ms
  });

  // Success
  await updateDeliveryLog(message.deliveryId, {
    status: 'success',
    response_status_code: response.status,
    response_body: response.data,
    latency_ms: response.latency
  });

} catch (error) {
  // Failure - publish to retry topic
  if (message.retryAttempt < message.maxRetries) {
    const retryMessage = {
      ...message,
      retryAttempt: message.retryAttempt + 1,
      nextRetryAt: calculateNextRetry(message.retryAttempt, message.backoffStrategy)
    };

    await publishMessage('retry-messages', retryMessage, retryMessage.deliveryId);

    await updateDeliveryLog(message.deliveryId, {
      status: 'retrying',
      error_message: error.message,
      next_retry_at: retryMessage.nextRetryAt
    });
  } else {
    // Max retries reached - move to DLQ
    await moveToDeadLetterQueue(message);
  }
}
```

---

#### 2. Notify the delivery status checker system for failed delivery notification

**Implementation**:
```typescript
// Publish to status-notifications topic
await publishMessage('status-notifications', {
  notificationType: 'delivery_failed',
  deliveryId: message.deliveryId,
  subscriptionId: message.subscriptionId,
  subscriberId: message.subscriberId,
  errorMessage: error.message,
  retryAttempt: message.retryAttempt,
  timestamp: new Date().toISOString()
});
```

---

### b. Update the delivery status in database

**Implementation**: ✅ Covered above
```typescript
await updateDeliveryLog(deliveryId, {
  status: 'success' | 'failed' | 'retrying',
  response_status_code: statusCode,
  latency_ms: latency,
  delivered_at: new Date()
});
```

---

### c. Send the message to Egress Gateway

**Implementation**:
- **Module**: `backend/shared/utils/egressGateway.ts`

**Code**:
```typescript
// backend/shared/utils/egressGateway.ts
import axios from 'axios';
import { generateWebhookSignature } from './crypto';

export async function sendWebhook(config: {
  url: string;
  payload: any;
  secret: string;
  timeout: number;
  headers?: Record<string, string>;
}): Promise<any> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateWebhookSignature(config.payload, config.secret, timestamp);

  const startTime = Date.now();

  const response = await axios.post(config.url, config.payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Event-Timestamp': timestamp.toString(),
      ...config.headers
    },
    timeout: config.timeout,
    validateStatus: (status) => status >= 200 && status < 600 // Don't throw on 4xx/5xx
  });

  const latency = Date.now() - startTime;

  return {
    status: response.status,
    headers: response.headers,
    data: response.data,
    latency
  };
}
```

**Code Location**: `backend/shared/utils/egressGateway.ts`

---

## ✅ Requirement 7: Delivery Retry process will consume the retry message

**Implementation**:
- **Lambda Function**: `delivery-retry-consumer` (to be created)
- **Kafka Topic**: `retry-messages` (consumer)
- **Kafka Topic**: `delivery-messages` (producer for retry)
- **Kafka Topic**: `status-notifications` (producer for failed)

### a. Push the retry delivery message to delivery message store

**Implementation**:
```typescript
// In delivery-retry-consumer Lambda
export async function handler(event: KafkaEvent) {
  for (const record of event.records) {
    const retryMessage = parseMessage(record);

    // Check if ready for retry based on nextRetryAt
    const now = new Date();
    const nextRetry = new Date(retryMessage.nextRetryAt);

    if (now < nextRetry) {
      // Not ready yet, skip (Kafka will retry)
      continue;
    }

    // Ready for retry - republish to delivery-messages
    await publishMessage('delivery-messages', retryMessage, retryMessage.deliveryId);

    console.log(`Retry ${retryMessage.retryAttempt} queued for delivery ${retryMessage.deliveryId}`);
  }
}
```

---

### b. Push the failed message to delivery status checker system

**Implementation**:
```typescript
// If max retries exceeded
if (retryMessage.retryAttempt >= retryMessage.maxRetries) {
  // Publish to status checker
  await publishMessage('status-notifications', {
    notificationType: 'delivery_permanently_failed',
    deliveryId: retryMessage.deliveryId,
    subscriptionId: retryMessage.subscriptionId,
    subscriberId: retryMessage.subscriberId,
    totalAttempts: retryMessage.retryAttempt,
    errorMessage: retryMessage.lastError,
    timestamp: new Date().toISOString()
  });
}
```

---

### c. Update the webhook database with the failed delivery status

**Implementation**:
```typescript
await updateDeliveryLog(retryMessage.deliveryId, {
  status: 'failed',
  error_message: retryMessage.lastError,
  error_code: 'MAX_RETRIES_EXCEEDED'
});

// Move to DLQ
await query(`
  INSERT INTO delivery_dlq (
    delivery_id, event_id, subscription_id, subscriber_id,
    request_url, request_payload, final_error_message, total_attempts
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`, [
  retryMessage.deliveryId,
  retryMessage.eventId,
  retryMessage.subscriptionId,
  retryMessage.subscriberId,
  retryMessage.webhookUrl,
  retryMessage.payload,
  retryMessage.lastError,
  retryMessage.retryAttempt
]);
```

---

## 📊 Complete Data Flow Summary

```
┌─────────────────┐
│ 1. Producer     │
│    Onboards     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Producer     │
│    Publishes    │
│    Schema       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│ Schema Registry │─────▶│ Webhook DB      │
│ (AWS Glue)      │      │ (schemas table) │
└─────────────────┘      └─────────────────┘
         │
         ▼
┌─────────────────┐
│ 3. Partner      │
│    Subscribes   │
│    via API      │
│    Exchange     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│ Subscriptions   │─────▶│ Email           │
│ Table           │      │ Notification    │
└─────────────────┘      └─────────────────┘
         │
         ▼
┌─────────────────┐
│ 4. Internal     │
│    System Posts │
│    Event        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│ Validate        │◀─────│ Schema Registry │
│ Payload         │      └─────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. Kafka        │
│    delivery-    │
│    messages     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│ 6. Delivery     │─────▶│ Egress Gateway  │
│    Consumer     │      │ (HTTP Client)   │
└────────┬────────┘      └────────┬────────┘
         │                        │
         │ Failure                │ Success
         ▼                        ▼
┌─────────────────┐      ┌─────────────────┐
│ 7. Kafka        │      │ Update DB       │
│    retry-       │      │ status=success  │
│    messages     │      └─────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│ Delivery Retry  │─────▶│ Re-publish or   │
│ Consumer        │      │ Move to DLQ     │
└─────────────────┘      └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Status Checker  │
│ (Notifications) │
└─────────────────┘
```

---

## ✅ Implementation Status

| Requirement | Status | Component | Location |
|-------------|--------|-----------|----------|
| 1a. Producer Onboarding | 🟡 Pending | producer-onboarding Lambda | `backend/lambda/producer-onboarding/` |
| 1b. Schema Registration | 🟡 Pending | schema-admin Lambda | `backend/lambda/schema-admin/` |
| 2a. Store in DB | ✅ Done | Database schema | `database/migrations/002_enhanced_schema.sql` |
| 2b. Schema Registry | 🟡 Pending | schemaRegistry utility | `backend/shared/utils/schemaRegistry.ts` |
| 3. Partner Subscription | 🟡 Pending | subscription-admin Lambda | `backend/lambda/subscription-admin/` |
| 4a. Store Subscription | ✅ Done | Database schema | `database/migrations/002_enhanced_schema.sql` |
| 4b. Email Notification | 🟡 Pending | notification-service Lambda | `backend/lambda/notification-service/` |
| 5. Event Publishing | 🟡 Pending | event-publisher Lambda | `backend/lambda/event-publisher/` |
| 6. Delivery Process | 🟡 Pending | delivery-consumer Lambda | `backend/lambda/delivery-consumer/` |
| 7. Retry Process | 🟡 Pending | delivery-retry-consumer Lambda | `backend/lambda/delivery-retry-consumer/` |

---

**All your requirements are now fully mapped and ready for implementation!**