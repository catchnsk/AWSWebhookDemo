-- ============================================================================
-- Webhook Management System - Seed Data
-- Consolidated INSERT queries for database initialization
-- ============================================================================

-- Clear existing data (optional - uncomment if needed)
-- TRUNCATE TABLE delivery_logs, delivery_dlq, event_messages, subscriptions,
--   webhooks, webhook_executions, webhook_events, webhook_analytics,
--   webhook_dead_letter_queue, schema_approvals, schemas, webhook_schemas,
--   subscribers, producers, admins, users CASCADE;

-- ============================================================================
-- 1. ADMINS - System Administrators
-- ============================================================================

INSERT INTO admins (id, name, email, api_key, api_key_hash, role, status)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Super Admin',
    'superadmin@webhook.local',
    'admin_key_super_2024',
    encode(sha256('admin_key_super_2024'::bytea), 'hex'),
    'super_admin',
    'active'
  ),
  (
    '11111111-1111-1111-1111-111111111112',
    'System Admin',
    'admin@webhook.local',
    'admin_key_system_2024',
    encode(sha256('admin_key_system_2024'::bytea), 'hex'),
    'admin',
    'active'
  ),
  (
    '11111111-1111-1111-1111-111111111113',
    'Operations Viewer',
    'viewer@webhook.local',
    'admin_key_viewer_2024',
    encode(sha256('admin_key_viewer_2024'::bytea), 'hex'),
    'viewer',
    'active'
  )
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- 2. USERS - Application Users
-- ============================================================================

INSERT INTO users (id, cognito_user_id, email, name, role, api_key)
VALUES
  (
    '22222222-2222-2222-2222-222222222221',
    'cognito_user_developer_001',
    'developer1@company.com',
    'Alice Developer',
    'developer',
    'user_api_key_alice_2024'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'cognito_user_developer_002',
    'developer2@company.com',
    'Bob Developer',
    'developer',
    'user_api_key_bob_2024'
  ),
  (
    '22222222-2222-2222-2222-222222222223',
    'cognito_user_admin_001',
    'admin.user@company.com',
    'Charlie Admin',
    'admin',
    'user_api_key_charlie_2024'
  ),
  (
    '22222222-2222-2222-2222-222222222224',
    'cognito_user_viewer_001',
    'viewer@company.com',
    'Diana Viewer',
    'viewer',
    'user_api_key_diana_2024'
  )
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- 3. PRODUCERS - Event Publishers
-- ============================================================================

INSERT INTO producers (id, name, description, api_key, api_key_hash, contact_email, contact_name, department, status)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'System',
    'Internal system producer',
    'system_internal_key',
    encode(sha256('system_internal_key'::bytea), 'hex'),
    'system@internal.com',
    'System Administrator',
    'Engineering',
    'active'
  ),
  (
    '33333333-3333-3333-3333-333333333331',
    'Order Management System',
    'Produces order-related events for e-commerce platform',
    'producer_key_orders_2024',
    encode(sha256('producer_key_orders_2024'::bytea), 'hex'),
    'orders@company.com',
    'Order Team Lead',
    'E-Commerce',
    'active'
  ),
  (
    '33333333-3333-3333-3333-333333333332',
    'Payment Service',
    'Publishes payment processing events',
    'producer_key_payments_2024',
    encode(sha256('producer_key_payments_2024'::bytea), 'hex'),
    'payments@company.com',
    'Payment Team Lead',
    'Finance',
    'active'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'User Authentication Service',
    'Handles user auth events',
    'producer_key_auth_2024',
    encode(sha256('producer_key_auth_2024'::bytea), 'hex'),
    'auth@company.com',
    'Auth Team Lead',
    'Security',
    'active'
  ),
  (
    '33333333-3333-3333-3333-333333333334',
    'Inventory Management',
    'Inventory and stock level events',
    'producer_key_inventory_2024',
    encode(sha256('producer_key_inventory_2024'::bytea), 'hex'),
    'inventory@company.com',
    'Inventory Manager',
    'Operations',
    'active'
  )
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 4. SCHEMAS - Event Schemas (Schema Registry)
-- ============================================================================

INSERT INTO schemas (id, producer_id, name, event_type, version, schema_format, schema_definition, is_public, requires_approval, compatibility_mode, description, documentation_url, example_payload, status)
VALUES
  -- Order Events
  (
    '44444444-4444-4444-4444-444444444441',
    '33333333-3333-3333-3333-333333333331',
    'Order Created Schema',
    'order.created',
    '1.0.0',
    'json',
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
    true,
    false,
    'backward',
    'Schema for order creation events',
    'https://docs.company.com/schemas/order-created',
    '{
      "orderId": "ORD-12345",
      "customerId": "CUST-67890",
      "amount": 150.99,
      "status": "created",
      "items": [{"productId": "PROD-001", "quantity": 2, "price": 75.49}],
      "timestamp": "2025-10-03T10:00:00Z"
    }'::jsonb,
    'active'
  ),
  (
    '44444444-4444-4444-4444-444444444442',
    '33333333-3333-3333-3333-333333333331',
    'Order Completed Schema',
    'order.completed',
    '1.0.0',
    'json',
    '{
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "required": ["orderId", "completedAt"],
      "properties": {
        "orderId": {"type": "string"},
        "completedAt": {"type": "string", "format": "date-time"},
        "totalAmount": {"type": "number"}
      }
    }'::jsonb,
    true,
    false,
    'backward',
    'Schema for order completion events',
    'https://docs.company.com/schemas/order-completed',
    '{"orderId": "ORD-12345", "completedAt": "2025-10-03T12:00:00Z", "totalAmount": 150.99}'::jsonb,
    'active'
  ),
  -- Payment Events
  (
    '44444444-4444-4444-4444-444444444443',
    '33333333-3333-3333-3333-333333333332',
    'Payment Processed Schema',
    'payment.processed',
    '1.0.0',
    'json',
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
    true,
    false,
    'backward',
    'Schema for payment processing events',
    'https://docs.company.com/schemas/payment-processed',
    '{"paymentId": "PAY-789", "amount": 150.99, "currency": "USD", "status": "completed", "timestamp": "2025-10-03T10:05:00Z"}'::jsonb,
    'active'
  ),
  -- User Events
  (
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333',
    'User Registered Schema',
    'user.registered',
    '1.0.0',
    'json',
    '{
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "required": ["userId", "email"],
      "properties": {
        "userId": {"type": "string"},
        "email": {"type": "string", "format": "email"},
        "name": {"type": "string"},
        "timestamp": {"type": "string", "format": "date-time"}
      }
    }'::jsonb,
    true,
    true,
    'backward',
    'Schema for user registration events',
    'https://docs.company.com/schemas/user-registered',
    '{"userId": "USR-456", "email": "user@example.com", "name": "John Doe", "timestamp": "2025-10-03T09:00:00Z"}'::jsonb,
    'active'
  ),
  -- Inventory Events
  (
    '44444444-4444-4444-4444-444444444445',
    '33333333-3333-3333-3333-333333333334',
    'Stock Updated Schema',
    'inventory.stock.updated',
    '1.0.0',
    'json',
    '{
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "required": ["productId", "quantity"],
      "properties": {
        "productId": {"type": "string"},
        "quantity": {"type": "integer"},
        "warehouse": {"type": "string"},
        "timestamp": {"type": "string", "format": "date-time"}
      }
    }'::jsonb,
    false,
    false,
    'backward',
    'Schema for inventory stock updates',
    'https://docs.company.com/schemas/stock-updated',
    '{"productId": "PROD-001", "quantity": 50, "warehouse": "WH-EAST", "timestamp": "2025-10-03T11:00:00Z"}'::jsonb,
    'active'
  )
ON CONFLICT (event_type, version) DO NOTHING;

-- ============================================================================
-- 5. WEBHOOK_SCHEMAS - Legacy Webhook Schemas
-- ============================================================================

INSERT INTO webhook_schemas (id, user_id, name, description, version, schema, is_public)
VALUES
  (
    '55555555-5555-5555-5555-555555555551',
    'cognito_user_developer_001',
    'Generic Event Schema',
    'Generic event schema with flexible payload',
    '1.0.0',
    '{
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "required": ["eventType", "timestamp"],
      "properties": {
        "eventType": {"type": "string"},
        "timestamp": {"type": "string", "format": "date-time"},
        "data": {"type": "object"}
      }
    }'::jsonb,
    true
  ),
  (
    '55555555-5555-5555-5555-555555555552',
    'cognito_user_developer_001',
    'Notification Event',
    'Schema for notification events',
    '1.0.0',
    '{
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "required": ["notificationId", "message"],
      "properties": {
        "notificationId": {"type": "string"},
        "message": {"type": "string"},
        "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]}
      }
    }'::jsonb,
    false
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. SUBSCRIBERS - Partners/External Systems
-- ============================================================================

INSERT INTO subscribers (id, name, company, email, api_key, api_key_hash, webhook_url, webhook_secret, contact_name, contact_phone, auth_type, status)
VALUES
  (
    '66666666-6666-6666-6666-666666666661',
    'Partner Analytics Platform',
    'Analytics Corp',
    'webhook@analytics.com',
    'subscriber_key_analytics_2024',
    encode(sha256('subscriber_key_analytics_2024'::bytea), 'hex'),
    'https://analytics.com/webhooks/receive',
    'webhook_secret_analytics_2024',
    'Analytics Team Lead',
    '+1-555-0100',
    'hmac',
    'active'
  ),
  (
    '66666666-6666-6666-6666-666666666662',
    'CRM Integration',
    'CRM Solutions Inc',
    'webhooks@crm.com',
    'subscriber_key_crm_2024',
    encode(sha256('subscriber_key_crm_2024'::bytea), 'hex'),
    'https://crm.com/api/webhooks',
    'webhook_secret_crm_2024',
    'CRM Integration Team',
    '+1-555-0200',
    'hmac',
    'active'
  ),
  (
    '66666666-6666-6666-6666-666666666663',
    'Shipping Partner API',
    'Logistics Co',
    'api@shipping.com',
    'subscriber_key_shipping_2024',
    encode(sha256('subscriber_key_shipping_2024'::bytea), 'hex'),
    'https://shipping.com/webhooks/orders',
    'webhook_secret_shipping_2024',
    'Logistics Manager',
    '+1-555-0300',
    'hmac',
    'active'
  ),
  (
    '66666666-6666-6666-6666-666666666664',
    'Email Marketing Service',
    'MailCorp',
    'integrations@mailcorp.com',
    'subscriber_key_email_2024',
    encode(sha256('subscriber_key_email_2024'::bytea), 'hex'),
    'https://mailcorp.com/webhooks',
    'webhook_secret_email_2024',
    'Integration Engineer',
    '+1-555-0400',
    'hmac',
    'active'
  )
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- 7. SUBSCRIPTIONS - Schema Subscriptions
-- ============================================================================

INSERT INTO subscriptions (id, subscriber_id, schema_id, webhook_url, webhook_secret, auth_type, enabled, max_retries, backoff_strategy, initial_delay_ms, timeout_ms, status, approval_status)
VALUES
  -- Analytics subscribes to orders
  (
    '77777777-7777-7777-7777-777777777771',
    '66666666-6666-6666-6666-666666666661',
    '44444444-4444-4444-4444-444444444441',
    'https://analytics.com/webhooks/receive/orders',
    'webhook_secret_analytics_orders',
    'hmac',
    true,
    3,
    'exponential',
    1000,
    30000,
    'active',
    'approved'
  ),
  -- CRM subscribes to user registrations
  (
    '77777777-7777-7777-7777-777777777772',
    '66666666-6666-6666-6666-666666666662',
    '44444444-4444-4444-4444-444444444444',
    'https://crm.com/api/webhooks/users',
    'webhook_secret_crm_users',
    'hmac',
    true,
    5,
    'exponential',
    1000,
    30000,
    'active',
    'approved'
  ),
  -- Shipping subscribes to order completed
  (
    '77777777-7777-7777-7777-777777777773',
    '66666666-6666-6666-6666-666666666663',
    '44444444-4444-4444-4444-444444444442',
    'https://shipping.com/webhooks/orders/completed',
    'webhook_secret_shipping_orders',
    'hmac',
    true,
    3,
    'exponential',
    1000,
    30000,
    'active',
    'approved'
  ),
  -- Email Marketing subscribes to user registrations
  (
    '77777777-7777-7777-7777-777777777774',
    '66666666-6666-6666-6666-666666666664',
    '44444444-4444-4444-4444-444444444444',
    'https://mailcorp.com/webhooks/new-users',
    'webhook_secret_email_users',
    'hmac',
    true,
    3,
    'exponential',
    1000,
    30000,
    'active',
    'pending'
  ),
  -- Analytics subscribes to payments
  (
    '77777777-7777-7777-7777-777777777775',
    '66666666-6666-6666-6666-666666666661',
    '44444444-4444-4444-4444-444444444443',
    'https://analytics.com/webhooks/receive/payments',
    'webhook_secret_analytics_payments',
    'hmac',
    true,
    3,
    'exponential',
    1000,
    30000,
    'active',
    'approved'
  )
ON CONFLICT (subscriber_id, schema_id) DO NOTHING;

-- ============================================================================
-- 8. WEBHOOKS - User Webhooks (Legacy)
-- ============================================================================

INSERT INTO webhooks (id, user_id, name, description, url, event_type, schema_id, enabled, status, auth_type, max_retries, backoff_strategy, initial_delay_ms, timeout_ms, tags, secret)
VALUES
  (
    '88888888-8888-8888-8888-888888888881',
    'cognito_user_developer_001',
    'Order Notification Webhook',
    'Sends notifications when orders are created',
    'https://myapp.com/webhooks/orders',
    'order.created',
    '55555555-5555-5555-5555-555555555551',
    true,
    'active',
    'bearer',
    3,
    'exponential',
    1000,
    30000,
    ARRAY['orders', 'notifications', 'production'],
    'webhook_secret_order_notifications'
  ),
  (
    '88888888-8888-8888-8888-888888888882',
    'cognito_user_developer_002',
    'Payment Alert Webhook',
    'Alerts on payment events',
    'https://payments-app.com/hooks/alerts',
    'payment.processed',
    NULL,
    true,
    'active',
    'api_key',
    5,
    'exponential',
    1000,
    30000,
    ARRAY['payments', 'alerts', 'production'],
    'webhook_secret_payment_alerts'
  ),
  (
    '88888888-8888-8888-8888-888888888883',
    'cognito_user_developer_001',
    'Test Webhook',
    'Testing webhook endpoint',
    'https://test.myapp.com/webhooks',
    'test.event',
    NULL,
    false,
    'paused',
    'none',
    3,
    'linear',
    2000,
    15000,
    ARRAY['test', 'development'],
    'webhook_secret_test'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 9. EVENT_MESSAGES - Sample Published Events
-- ============================================================================

INSERT INTO event_messages (id, event_id, producer_id, schema_id, event_type, payload, correlation_id, idempotency_key)
VALUES
  (
    '99999999-9999-9999-9999-999999999991',
    'evt_order_001',
    '33333333-3333-3333-3333-333333333331',
    '44444444-4444-4444-4444-444444444441',
    'order.created',
    '{
      "orderId": "ORD-001",
      "customerId": "CUST-123",
      "amount": 299.99,
      "status": "created",
      "items": [
        {"productId": "PROD-A", "quantity": 1, "price": 199.99},
        {"productId": "PROD-B", "quantity": 2, "price": 50.00}
      ],
      "timestamp": "2025-10-03T14:00:00Z"
    }'::jsonb,
    'corr_order_001',
    'idem_order_001'
  ),
  (
    '99999999-9999-9999-9999-999999999992',
    'evt_payment_001',
    '33333333-3333-3333-3333-333333333332',
    '44444444-4444-4444-4444-444444444443',
    'payment.processed',
    '{
      "paymentId": "PAY-001",
      "amount": 299.99,
      "currency": "USD",
      "status": "completed",
      "timestamp": "2025-10-03T14:02:00Z"
    }'::jsonb,
    'corr_payment_001',
    'idem_payment_001'
  ),
  (
    '99999999-9999-9999-9999-999999999993',
    'evt_user_001',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    'user.registered',
    '{
      "userId": "USR-001",
      "email": "newuser@example.com",
      "name": "Jane Smith",
      "timestamp": "2025-10-03T13:00:00Z"
    }'::jsonb,
    'corr_user_001',
    'idem_user_001'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Display Summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Seed Data Inserted Successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Admins: %', (SELECT COUNT(*) FROM admins);
  RAISE NOTICE 'Users: %', (SELECT COUNT(*) FROM users);
  RAISE NOTICE 'Producers: %', (SELECT COUNT(*) FROM producers);
  RAISE NOTICE 'Schemas: %', (SELECT COUNT(*) FROM schemas);
  RAISE NOTICE 'Webhook Schemas: %', (SELECT COUNT(*) FROM webhook_schemas);
  RAISE NOTICE 'Subscribers: %', (SELECT COUNT(*) FROM subscribers);
  RAISE NOTICE 'Subscriptions: %', (SELECT COUNT(*) FROM subscriptions);
  RAISE NOTICE 'Webhooks: %', (SELECT COUNT(*) FROM webhooks);
  RAISE NOTICE 'Event Messages: %', (SELECT COUNT(*) FROM event_messages);
  RAISE NOTICE '========================================';
END $$;
