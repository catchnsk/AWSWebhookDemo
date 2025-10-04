# Database Insert Queries

This document provides necessary INSERT queries for populating the webhook management system database tables.

## Table of Contents
- [Users](#users)
- [Admins](#admins)
- [Producers](#producers)
- [Schemas](#schemas)
- [Subscribers](#subscribers)
- [Subscriptions](#subscriptions)
- [Webhooks](#webhooks)
- [Event Messages](#event-messages)
- [Webhook Schemas](#webhook-schemas)

---

## Users

Insert a new user account:

```sql
INSERT INTO users (
    cognito_user_id,
    email,
    name,
    role,
    api_key
) VALUES (
    'cognito_user_123456',
    'john.doe@example.com',
    'John Doe',
    'developer',  -- Options: 'admin', 'developer', 'viewer'
    'user_api_key_' || gen_random_uuid()::text
);
```

---

## Admins

Insert a new admin user:

```sql
INSERT INTO admins (
    name,
    email,
    api_key,
    api_key_hash,
    role,
    status
) VALUES (
    'Admin User',
    'admin@example.com',
    'admin_api_key_' || gen_random_uuid()::text,
    encode(sha256(('admin_api_key_' || gen_random_uuid()::text)::bytea), 'hex'),
    'admin',  -- Options: 'super_admin', 'admin', 'viewer'
    'active'  -- Options: 'active', 'inactive', 'suspended'
);
```

---

## Producers

Insert a new event producer:

```sql
INSERT INTO producers (
    name,
    description,
    api_key,
    api_key_hash,
    contact_email,
    contact_name,
    department,
    status
) VALUES (
    'Order Management System',
    'Produces order-related events',
    'producer_api_key_' || gen_random_uuid()::text,
    encode(sha256(('producer_api_key_' || gen_random_uuid()::text)::bytea), 'hex'),
    'orders@company.com',
    'Order Team Lead',
    'E-Commerce',
    'active'  -- Options: 'active', 'inactive', 'suspended'
);
```

---

## Schemas

Insert a new event schema:

```sql
INSERT INTO schemas (
    producer_id,
    name,
    event_type,
    version,
    schema_format,
    schema_definition,
    is_public,
    requires_approval,
    compatibility_mode,
    description,
    documentation_url,
    example_payload,
    status
) VALUES (
    '00000000-0000-0000-0000-000000000001',  -- Replace with actual producer_id
    'Order Created Schema',
    'order.created',
    '1.0.0',
    'json',  -- Options: 'json', 'avro', 'protobuf'
    '{
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "required": ["orderId", "customerId", "amount", "status"],
        "properties": {
            "orderId": {"type": "string"},
            "customerId": {"type": "string"},
            "amount": {"type": "number", "minimum": 0},
            "status": {"type": "string", "enum": ["created", "pending", "completed", "cancelled"]},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "productId": {"type": "string"},
                        "quantity": {"type": "integer", "minimum": 1},
                        "price": {"type": "number", "minimum": 0}
                    }
                }
            },
            "timestamp": {"type": "string", "format": "date-time"}
        }
    }'::jsonb,
    true,  -- is_public
    false,  -- requires_approval
    'backward',  -- Options: 'none', 'backward', 'forward', 'full', 'backward_transitive', 'forward_transitive', 'full_transitive'
    'Schema for order creation events',
    'https://docs.company.com/schemas/order-created',
    '{
        "orderId": "ORD-12345",
        "customerId": "CUST-67890",
        "amount": 150.99,
        "status": "created",
        "items": [
            {
                "productId": "PROD-001",
                "quantity": 2,
                "price": 75.49
            }
        ],
        "timestamp": "2025-10-03T10:00:00Z"
    }'::jsonb,
    'active'  -- Options: 'active', 'deprecated', 'disabled'
);
```

---

## Subscribers

Insert a new subscriber (partner/external system):

```sql
INSERT INTO subscribers (
    name,
    company,
    email,
    api_key,
    api_key_hash,
    webhook_url,
    webhook_secret,
    contact_name,
    contact_phone,
    auth_type,
    ip_whitelist,
    status
) VALUES (
    'Partner System',
    'Partner Company Inc.',
    'webhook@partner.com',
    'subscriber_api_key_' || gen_random_uuid()::text,
    encode(sha256(('subscriber_api_key_' || gen_random_uuid()::text)::bytea), 'hex'),
    'https://partner.com/webhooks/receive',
    'webhook_secret_' || gen_random_uuid()::text,
    'Partner Tech Lead',
    '+1-555-0100',
    'hmac',  -- Options: 'none', 'hmac', 'mtls', 'oauth2'
    ARRAY['192.168.1.100', '10.0.0.50'],  -- IP whitelist
    'active'  -- Options: 'active', 'inactive', 'suspended'
);
```

---

## Subscriptions

Insert a new subscription (subscriber to schema):

```sql
INSERT INTO subscriptions (
    subscriber_id,
    schema_id,
    webhook_url,
    webhook_secret,
    auth_type,
    custom_headers,
    enabled,
    max_retries,
    backoff_strategy,
    initial_delay_ms,
    timeout_ms,
    status,
    approval_status
) VALUES (
    '11111111-1111-1111-1111-111111111111',  -- Replace with actual subscriber_id
    '22222222-2222-2222-2222-222222222222',  -- Replace with actual schema_id
    'https://partner.com/webhooks/receive',
    'webhook_secret_' || gen_random_uuid()::text,
    'hmac',
    '{
        "X-Custom-Header": "custom-value",
        "X-Client-ID": "partner-123"
    }'::jsonb,
    true,  -- enabled
    3,  -- max_retries (0-10)
    'exponential',  -- Options: 'exponential', 'linear', 'constant'
    1000,  -- initial_delay_ms (minimum 100)
    30000,  -- timeout_ms (1000-300000)
    'active',  -- Options: 'active', 'paused', 'suspended', 'cancelled'
    'approved'  -- Options: 'pending', 'approved', 'rejected'
);
```

---

## Webhooks

Insert a new webhook:

```sql
INSERT INTO webhooks (
    user_id,
    name,
    description,
    url,
    event_type,
    schema_id,
    enabled,
    status,
    auth_type,
    auth_config,
    max_retries,
    backoff_strategy,
    initial_delay_ms,
    timeout_ms,
    custom_headers,
    tags,
    secret
) VALUES (
    'cognito_user_123456',  -- Replace with actual user_id
    'Order Notification Webhook',
    'Sends notifications when orders are created',
    'https://myapp.com/webhooks/orders',
    'order.created',
    '22222222-2222-2222-2222-222222222222',  -- Replace with actual schema_id or NULL
    true,  -- enabled
    'active',  -- Options: 'active', 'paused', 'failed', 'disabled'
    'bearer',  -- Options: 'bearer', 'api_key', 'oauth2', 'basic', 'none'
    '{
        "token": "encrypted_bearer_token_here"
    }'::jsonb,
    3,  -- max_retries (0-10)
    'exponential',  -- Options: 'exponential', 'linear', 'constant'
    1000,  -- initial_delay_ms (must be > 0)
    30000,  -- timeout_ms (must be > 0)
    '{
        "Content-Type": "application/json",
        "X-Webhook-Source": "order-system"
    }'::jsonb,
    ARRAY['orders', 'notifications', 'production'],  -- tags
    'webhook_secret_' || gen_random_uuid()::text  -- secret for HMAC
);
```

---

## Event Messages

Insert a new event message (published event):

```sql
INSERT INTO event_messages (
    event_id,
    producer_id,
    schema_id,
    event_type,
    payload,
    correlation_id,
    idempotency_key
) VALUES (
    'evt_' || gen_random_uuid()::text,
    '00000000-0000-0000-0000-000000000001',  -- Replace with actual producer_id
    '22222222-2222-2222-2222-222222222222',  -- Replace with actual schema_id
    'order.created',
    '{
        "orderId": "ORD-12345",
        "customerId": "CUST-67890",
        "amount": 150.99,
        "status": "created",
        "items": [
            {
                "productId": "PROD-001",
                "quantity": 2,
                "price": 75.49
            }
        ],
        "timestamp": "2025-10-03T10:00:00Z"
    }'::jsonb,
    'corr_' || gen_random_uuid()::text,  -- correlation_id for tracing
    'idem_' || gen_random_uuid()::text   -- idempotency_key for deduplication
);
```

---

## Webhook Schemas

Insert a new webhook schema (from initial schema):

```sql
INSERT INTO webhook_schemas (
    user_id,
    name,
    description,
    version,
    schema,
    is_public
) VALUES (
    'cognito_user_123456',  -- Replace with actual user_id
    'Payment Event Schema',
    'Schema for payment processing events',
    '1.0.0',
    '{
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "required": ["paymentId", "amount", "currency", "status"],
        "properties": {
            "paymentId": {"type": "string"},
            "amount": {"type": "number", "minimum": 0},
            "currency": {"type": "string", "pattern": "^[A-Z]{3}$"},
            "status": {"type": "string", "enum": ["pending", "completed", "failed", "refunded"]},
            "timestamp": {"type": "string", "format": "date-time"}
        }
    }'::jsonb,
    false  -- is_public (false for private schemas)
);
```

---

## Delivery Logs

Insert a delivery log entry:

```sql
INSERT INTO delivery_logs (
    delivery_id,
    event_id,
    subscription_id,
    subscriber_id,
    request_url,
    request_method,
    request_headers,
    request_payload,
    status,
    retry_attempt
) VALUES (
    'delivery_' || gen_random_uuid()::text,
    'evt_123456',  -- Replace with actual event_id
    '33333333-3333-3333-3333-333333333333',  -- Replace with actual subscription_id
    '11111111-1111-1111-1111-111111111111',  -- Replace with actual subscriber_id
    'https://partner.com/webhooks/receive',
    'POST',
    '{
        "Content-Type": "application/json",
        "X-Webhook-Signature": "sha256=abc123..."
    }'::jsonb,
    '{
        "orderId": "ORD-12345",
        "amount": 150.99
    }'::jsonb,
    'queued',  -- Options: 'queued', 'delivering', 'success', 'failed', 'retrying', 'timeout', 'cancelled'
    0  -- retry_attempt
);
```

---

## Webhook Executions

Insert a webhook execution record:

```sql
INSERT INTO webhook_executions (
    webhook_id,
    execution_id,
    request_url,
    request_method,
    request_headers,
    request_payload,
    status,
    retry_attempt
) VALUES (
    '44444444-4444-4444-4444-444444444444',  -- Replace with actual webhook_id
    'exec_' || gen_random_uuid()::text,
    'https://myapp.com/webhooks/orders',
    'POST',
    '{
        "Content-Type": "application/json",
        "Authorization": "Bearer token123"
    }'::jsonb,
    '{
        "orderId": "ORD-12345",
        "amount": 150.99,
        "timestamp": "2025-10-03T10:00:00Z"
    }'::jsonb,
    'queued',  -- Options: 'queued', 'processing', 'success', 'failed', 'retrying', 'timeout', 'cancelled'
    0  -- retry_attempt
);
```

---

## Webhook Events (Audit Log)

Insert an audit log entry:

```sql
INSERT INTO webhook_events (
    webhook_id,
    user_id,
    event_type,
    event_data,
    ip_address,
    user_agent
) VALUES (
    '44444444-4444-4444-4444-444444444444',  -- Replace with actual webhook_id
    'cognito_user_123456',  -- Replace with actual user_id
    'webhook.created',  -- Event types: webhook.created, webhook.updated, webhook.deleted, webhook.triggered
    '{
        "webhook_name": "Order Notification Webhook",
        "url": "https://myapp.com/webhooks/orders"
    }'::jsonb,
    '192.168.1.100',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...'
);
```

---

## Notes

1. **UUID Generation**: All tables use UUIDs as primary keys. PostgreSQL's `gen_random_uuid()` function generates random UUIDs automatically.

2. **API Key Hashing**: For security, API keys should be hashed using SHA256. Example:
   ```sql
   encode(sha256('your_api_key'::bytea), 'hex')
   ```

3. **Timestamps**: Most tables have `created_at` and `updated_at` columns that default to `CURRENT_TIMESTAMP`. The `updated_at` is automatically updated via triggers.

4. **JSONB Fields**: Many tables use JSONB for flexible data storage (schemas, configurations, headers, etc.). Make sure to cast JSON strings with `::jsonb`.

5. **Foreign Keys**: Replace placeholder UUIDs with actual IDs from related tables:
   - `user_id` → from `users` table (cognito_user_id)
   - `producer_id` → from `producers` table
   - `schema_id` → from `schemas` table
   - `subscriber_id` → from `subscribers` table
   - `subscription_id` → from `subscriptions` table
   - `webhook_id` → from `webhooks` table

6. **Enum Values**: Pay attention to CHECK constraints on columns like `role`, `status`, `auth_type`, etc. Only use the allowed values.

7. **Default Values**: Many fields have sensible defaults, so you can omit them from INSERT statements if the defaults are acceptable.

8. **Soft Deletes**: Tables like `webhooks` and `webhook_schemas` use `deleted_at` for soft deletion. Set this timestamp instead of actually deleting records.
