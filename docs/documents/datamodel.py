Webhook Management System - Complete Data Model

  Database: PostgreSQL 15+

  ---
  📊 Core Entities & Relationships

  PRODUCERS (Event Publishers)
      ↓ 1:N
  SCHEMAS (Event Definitions)
      ↓ N:M
  SUBSCRIBERS (Webhook Consumers)
      ↓ 1:N
  SUBSCRIPTIONS (Schema → Subscriber Mapping)
      ↓
  EVENT_MESSAGES (Published Events)
      ↓ 1:N
  DELIVERY_QUEUE → DELIVERY_LOGS → DELIVERY_DLQ

  ---
  1. USERS TABLE

  Purpose: System administrators and developers

  | Column             | Type         | Description                  |
  |--------------------|--------------|------------------------------|
  | id                 | UUID         | Primary key                  |
  | cognito_user_id    | VARCHAR(255) | AWS Cognito user ID (unique) |
  | email              | VARCHAR(255) | User email (unique)          |
  | name               | VARCHAR(255) | Full name                    |
  | role               | VARCHAR(50)  | admin, developer, viewer     |
  | api_key            | VARCHAR(255) | Optional API key (unique)    |
  | api_key_created_at | TIMESTAMP    | API key creation timestamp   |
  | created_at         | TIMESTAMP    | Record creation              |
  | updated_at         | TIMESTAMP    | Last update                  |
  | last_login_at      | TIMESTAMP    | Last login timestamp         |

  Indexes: cognito_user_id, email, api_key, role

  ---
  2. PRODUCERS TABLE

  Purpose: Internal systems/services that publish events

  | Column                   | Type         | Description                   |
  |--------------------------|--------------|-------------------------------|
  | id                       | UUID         | Primary key                   |
  | name                     | VARCHAR(255) | Producer name (unique)        |
  | description              | TEXT         | Description                   |
  | api_key                  | VARCHAR(255) | Plain API key (unique)        |
  | api_key_hash             | VARCHAR(255) | SHA256 hash (unique)          |
  | contact_email            | VARCHAR(255) | Contact email                 |
  | contact_name             | VARCHAR(255) | Contact person                |
  | department               | VARCHAR(255) | Department                    |
  | status                   | VARCHAR(50)  | active, inactive, suspended   |
  | total_events_published   | BIGINT       | Event counter (denormalized)  |
  | total_schemas_registered | INTEGER      | Schema counter (denormalized) |
  | created_at               | TIMESTAMP    | Creation timestamp            |
  | updated_at               | TIMESTAMP    | Last update                   |
  | last_published_at        | TIMESTAMP    | Last event publish time       |

  Relationships:
  - 1:N with SCHEMAS
  - 1:N with EVENT_MESSAGES

  API Key Format: wh_prod_<64-char-hex>

  ---
  3. SCHEMAS TABLE

  Purpose: Event schema definitions (Schema Registry)

  | Column                  | Type          | Description                               |
  |-------------------------|---------------|-------------------------------------------|
  | id                      | UUID          | Primary key                               |
  | producer_id             | UUID          | FK → producers(id)                        |
  | schema_id               | VARCHAR(100)  | Auto-generated (SCHEMA-000001)            |
  | schema_registry_id      | VARCHAR(255)  | AWS Glue/Confluent Schema ID              |
  | schema_registry_version | INTEGER       | Schema registry version                   |
  | name                    | VARCHAR(255)  | Schema name                               |
  | event_type              | VARCHAR(255)  | Event type (e.g., order.created) (unique) |
  | version                 | VARCHAR(50)   | Semantic version (e.g., 1.0.0)            |
  | schema_format           | VARCHAR(50)   | json, avro, protobuf                      |
  | schema_definition       | JSONB         | JSON Schema definition                    |
  | is_public               | BOOLEAN       | Public/private visibility                 |
  | requires_approval       | BOOLEAN       | Requires admin approval                   |
  | compatibility_mode      | VARCHAR(50)   | backward, forward, full, etc.             |
  | description             | TEXT          | Description                               |
  | documentation_url       | VARCHAR(2048) | Documentation link                        |
  | example_payload         | JSONB         | Example payload                           |
  | domain                  | VARCHAR(50)   | payment, account, apply                   |
  | partner_user_id         | VARCHAR(255)  | Auto-generated partner ID                 |
  | system_user_id          | VARCHAR(255)  | System user reference                     |
  | subscription_count      | INTEGER       | Subscription counter (denormalized)       |
  | total_events_published  | BIGINT        | Event counter (denormalized)              |
  | status                  | VARCHAR(50)   | active, deprecated, disabled              |
  | created_at              | TIMESTAMP     | Creation timestamp                        |
  | updated_at              | TIMESTAMP     | Last update                               |
  | deprecated_at           | TIMESTAMP     | Deprecation timestamp                     |

  Unique Constraint: (event_type, version)

  Relationships:
  - N:1 with PRODUCERS
  - 1:N with SUBSCRIPTIONS
  - 1:N with EVENT_MESSAGES

  ---
  4. SUBSCRIBERS TABLE

  Purpose: External partners/systems receiving webhooks

  | Column                | Type          | Description                 |
  |-----------------------|---------------|-----------------------------|
  | id                    | UUID          | Primary key                 |
  | name                  | VARCHAR(255)  | Subscriber name             |
  | company               | VARCHAR(255)  | Company name                |
  | email                 | VARCHAR(255)  | Email (unique)              |
  | api_key               | VARCHAR(255)  | Plain API key (unique)      |
  | api_key_hash          | VARCHAR(255)  | SHA256 hash (unique)        |
  | webhook_url           | VARCHAR(2048) | Default webhook URL         |
  | webhook_secret        | VARCHAR(255)  | HMAC signature secret       |
  | contact_name          | VARCHAR(255)  | Contact person              |
  | contact_phone         | VARCHAR(50)   | Phone number                |
  | auth_type             | VARCHAR(50)   | none, hmac, mtls, oauth2    |
  | ip_whitelist          | TEXT[]        | Array of whitelisted IPs    |
  | total_subscriptions   | INTEGER       | Subscription counter        |
  | total_deliveries      | BIGINT        | Total deliveries            |
  | successful_deliveries | BIGINT        | Successful counter          |
  | failed_deliveries     | BIGINT        | Failed counter              |
  | status                | VARCHAR(50)   | active, inactive, suspended |
  | created_at            | TIMESTAMP     | Creation timestamp          |
  | updated_at            | TIMESTAMP     | Last update                 |
  | last_delivery_at      | TIMESTAMP     | Last delivery timestamp     |

  API Key Format: wh_<64-char-hex>

  Relationships:
  - 1:N with SUBSCRIPTIONS
  - 1:N with DELIVERY_LOGS
  - 1:N with DELIVERY_DLQ

  ---
  5. SUBSCRIPTIONS TABLE

  Purpose: Maps subscribers to schemas (pub/sub relationships)

  | Column                     | Type          | Description                          |
  |----------------------------|---------------|--------------------------------------|
  | id                         | UUID          | Primary key                          |
  | subscriber_id              | UUID          | FK → subscribers(id)                 |
  | schema_id                  | UUID          | FK → schemas(id)                     |
  | webhook_url                | VARCHAR(2048) | Override subscriber URL              |
  | webhook_secret             | VARCHAR(255)  | HMAC secret                          |
  | auth_type                  | VARCHAR(50)   | Auth mechanism                       |
  | auth_config                | JSONB         | Auth credentials                     |
  | custom_headers             | JSONB         | Custom HTTP headers                  |
  | enabled                    | BOOLEAN       | Active/paused                        |
  | max_retries                | INTEGER       | Max retry attempts (0-10)            |
  | backoff_strategy           | VARCHAR(50)   | exponential, linear, constant        |
  | initial_delay_ms           | INTEGER       | Initial retry delay                  |
  | timeout_ms                 | INTEGER       | Request timeout                      |
  | payload_filter             | JSONB         | JSONPath filter expressions          |
  | status                     | VARCHAR(50)   | active, paused, suspended, cancelled |
  | total_deliveries           | BIGINT        | Delivery counter                     |
  | successful_deliveries      | BIGINT        | Success counter                      |
  | failed_deliveries          | BIGINT        | Failure counter                      |
  | avg_latency_ms             | INTEGER       | Average latency                      |
  | consecutive_failures       | INTEGER       | Circuit breaker counter              |
  | last_delivery_at           | TIMESTAMP     | Last delivery time                   |
  | last_success_at            | TIMESTAMP     | Last success time                    |
  | last_failure_at            | TIMESTAMP     | Last failure time                    |
  | circuit_breaker_open_until | TIMESTAMP     | Circuit breaker timeout              |
  | approval_status            | VARCHAR(50)   | pending, approved, rejected          |
  | approved_by                | UUID          | Approver user ID                     |
  | approved_at                | TIMESTAMP     | Approval timestamp                   |
  | created_at                 | TIMESTAMP     | Creation timestamp                   |
  | updated_at                 | TIMESTAMP     | Last update                          |
  | cancelled_at               | TIMESTAMP     | Cancellation timestamp               |

  Unique Constraint: (subscriber_id, schema_id)

  Relationships:
  - N:1 with SUBSCRIBERS
  - N:1 with SCHEMAS
  - 1:N with DELIVERY_QUEUE
  - 1:N with DELIVERY_LOGS

  ---
  6. EVENT_MESSAGES TABLE

  Purpose: Published events (event log)

  | Column               | Type         | Description             |
  |----------------------|--------------|-------------------------|
  | id                   | UUID         | Primary key             |
  | event_id             | VARCHAR(255) | Unique event ID (UUID)  |
  | producer_id          | UUID         | FK → producers(id)      |
  | schema_id            | UUID         | FK → schemas(id)        |
  | event_type           | VARCHAR(255) | Event type              |
  | payload              | JSONB        | Event payload           |
  | correlation_id       | VARCHAR(255) | Distributed tracing ID  |
  | idempotency_key      | VARCHAR(255) | Deduplication key       |
  | subscriber_count     | INTEGER      | Number of subscribers   |
  | deliveries_queued    | INTEGER      | Queued delivery counter |
  | deliveries_completed | INTEGER      | Completed counter       |
  | deliveries_failed    | INTEGER      | Failed counter          |
  | published_at         | TIMESTAMP    | Publish timestamp       |
  | created_at           | TIMESTAMP    | Creation timestamp      |

  Indexes: event_id (unique), producer_id, schema_id, event_type, published_at, idempotency_key, correlation_id

  Relationships:
  - N:1 with PRODUCERS
  - N:1 with SCHEMAS
  - 1:N with DELIVERY_QUEUE
  - 1:N with DELIVERY_LOGS

  ---
  7. DELIVERY_QUEUE TABLE

  Purpose: Pending webhook deliveries (queue for worker processing)

  | Column           | Type          | Description                                     |
  |------------------|---------------|-------------------------------------------------|
  | id               | UUID          | Primary key                                     |
  | delivery_id      | VARCHAR(255)  | Unique delivery ID (UUID)                       |
  | event_id         | VARCHAR(255)  | FK → event_messages(event_id)                   |
  | subscription_id  | UUID          | FK → subscriptions(id)                          |
  | subscriber_id    | UUID          | FK → subscribers(id)                            |
  | webhook_url      | VARCHAR(2048) | Target URL                                      |
  | payload          | JSONB         | Event payload                                   |
  | max_retries      | INTEGER       | Max retry attempts                              |
  | backoff_strategy | VARCHAR(50)   | Retry strategy                                  |
  | status           | VARCHAR(50)   | queued, processing, completed, failed, retrying |
  | attempt_count    | INTEGER       | Current attempt number                          |
  | last_attempt_at  | TIMESTAMP     | Last attempt timestamp                          |
  | next_retry_at    | TIMESTAMP     | Next retry timestamp                            |
  | created_at       | TIMESTAMP     | Creation timestamp                              |
  | updated_at       | TIMESTAMP     | Last update                                     |

  Indexes: delivery_id (unique), event_id, subscription_id, status, next_retry_at (where status = 'retrying')

  Lifecycle:
  1. Created as queued when event published
  2. Worker picks up → processing
  3. Success → completed (moved to delivery_logs)
  4. Failure → retrying (with next_retry_at set)
  5. Max retries exceeded → failed (moved to DLQ)

  ---
  8. DELIVERY_LOGS TABLE

  Purpose: Delivery attempt history

  | Column               | Type          | Description                                                       |
  |----------------------|---------------|-------------------------------------------------------------------|
  | id                   | UUID          | Primary key                                                       |
  | delivery_id          | VARCHAR(255)  | Unique delivery ID (unique)                                       |
  | event_id             | VARCHAR(255)  | FK → event_messages(event_id)                                     |
  | subscription_id      | UUID          | FK → subscriptions(id)                                            |
  | subscriber_id        | UUID          | FK → subscribers(id)                                              |
  | request_url          | VARCHAR(2048) | Target URL                                                        |
  | request_method       | VARCHAR(10)   | HTTP method (POST)                                                |
  | request_headers      | JSONB         | Request headers                                                   |
  | request_payload      | JSONB         | Request body                                                      |
  | response_status_code | INTEGER       | HTTP status code                                                  |
  | response_headers     | JSONB         | Response headers                                                  |
  | response_body        | TEXT          | Response body                                                     |
  | status               | VARCHAR(50)   | queued, delivering, success, failed, retrying, timeout, cancelled |
  | retry_attempt        | INTEGER       | Attempt number                                                    |
  | latency_ms           | INTEGER       | Request latency                                                   |
  | error_message        | TEXT          | Error details                                                     |
  | error_code           | VARCHAR(100)  | Error code                                                        |
  | error_category       | VARCHAR(50)   | network, timeout, 4xx, 5xx, validation                            |
  | queued_at            | TIMESTAMP     | Queue timestamp                                                   |
  | delivered_at         | TIMESTAMP     | Delivery timestamp                                                |
  | next_retry_at        | TIMESTAMP     | Next retry (if retrying)                                          |
  | created_at           | TIMESTAMP     | Creation timestamp                                                |

  Indexes: delivery_id (unique), event_id, subscription_id, subscriber_id, status, created_at, next_retry_at
  (where status = 'retrying')

  ---
  9. DELIVERY_DLQ TABLE

  Purpose: Dead Letter Queue for permanently failed deliveries

  | Column               | Type          | Description            |
  |----------------------|---------------|------------------------|
  | id                   | UUID          | Primary key            |
  | delivery_id          | VARCHAR(255)  | Original delivery ID   |
  | event_id             | VARCHAR(255)  | Original event ID      |
  | subscription_id      | UUID          | FK → subscriptions(id) |
  | subscriber_id        | UUID          | FK → subscribers(id)   |
  | request_url          | VARCHAR(2048) | Target URL             |
  | request_payload      | JSONB         | Original payload       |
  | request_headers      | JSONB         | Request headers        |
  | final_error_message  | TEXT          | Final error message    |
  | final_error_code     | VARCHAR(100)  | Final error code       |
  | final_error_category | VARCHAR(50)   | Error category         |
  | total_attempts       | INTEGER       | Total retry attempts   |
  | first_attempt_at     | TIMESTAMP     | First attempt time     |
  | last_attempt_at      | TIMESTAMP     | Last attempt time      |
  | investigated         | BOOLEAN       | Investigation status   |
  | resolution_notes     | TEXT          | Resolution notes       |
  | resolved_by          | UUID          | Resolver user ID       |
  | assigned_to          | UUID          | Assigned investigator  |
  | created_at           | TIMESTAMP     | DLQ entry time         |
  | resolved_at          | TIMESTAMP     | Resolution timestamp   |

  Indexes: delivery_id, event_id, subscription_id, subscriber_id, investigated, created_at

  ---
  10. Additional Tables

  WEBHOOK_SCHEMAS (Legacy)

  Similar to SCHEMAS table but for old webhook-based architecture.

  WEBHOOKS (Legacy)

  Legacy webhook configurations (being migrated to subscription model).

  WEBHOOK_EXECUTIONS (Legacy)

  Legacy execution logs.

  WEBHOOK_ANALYTICS

  Aggregated metrics (hourly/daily/weekly/monthly).

  WEBHOOK_EVENTS

  Audit log for webhook lifecycle events.

  SCHEMA_APPROVALS

  Approval workflow for restricted schemas.

  NOTIFICATION_LOGS

  Email/SNS notification logs.

  ---
  📈 Key Features

  Auto-Generated Fields

  - Schemas: schema_id (SCHEMA-000001), partner_user_id (PARTNER-<uuid>)
  - Sequences: schemas_id_seq

  Triggers & Functions

  1. update_updated_at_column() - Auto-update timestamps
  2. update_webhook_statistics() - Update denormalized metrics
  3. update_subscription_statistics() - Update delivery stats
  4. update_schema_subscription_count() - Maintain subscription counters

  Views

  - subscription_health - Health status with success rates
  - producer_analytics - Producer statistics
  - webhook_stats - Webhook performance metrics
  - recent_webhook_executions - Recent deliveries
  - failed_webhooks_alert - Failures requiring attention

  ---
  🔐 Security

  - API Keys: SHA256 hashed for storage
  - Webhook Secrets: HMAC signature verification
  - Authentication: Bearer tokens, API keys, OAuth2, mTLS
  - IP Whitelisting: Subscriber IP restrictions

  ---
  🔄 Data Flow

  1. Producer publishes event → EVENT_MESSAGES
  2. Find active SUBSCRIPTIONS for schema
  3. Create DELIVERY_QUEUE entries
  4. Worker picks from queue → DELIVERY_LOGS
  5. Success → Update stats, mark complete
  6. Failure → Retry with backoff
  7. Max retries → DELIVERY_DLQ