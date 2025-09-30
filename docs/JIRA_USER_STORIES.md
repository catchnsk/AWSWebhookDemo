# JIRA User Stories - Webhook Management System

## Epic Overview

**Epic 1:** Producer Onboarding & Schema Management
**Epic 2:** Subscriber Management & API Exchange
**Epic 3:** Event Publishing & Delivery System
**Epic 4:** Retry Logic & Dead Letter Queue
**Epic 5:** Infrastructure & DevOps

---

## Epic 1: Producer Onboarding & Schema Management

### WH-001: Producer Self-Service Onboarding

**As a** backend service developer
**I want to** onboard my service as an event producer
**So that** I can start publishing events to the webhook platform

**Acceptance Criteria:**
- [ ] Producer can submit onboarding form with name, contact email, contact name, and department
- [ ] System generates unique API key for the producer upon successful onboarding
- [ ] API key is displayed only once and must be saved by the producer
- [ ] Producer receives welcome email with API key and getting started documentation
- [ ] Producer status is set to "active" by default
- [ ] API key is hashed before storing in database (never store plain text)
- [ ] Duplicate producer names are rejected with appropriate error message
- [ ] API returns 201 status with producer ID and API key on success

**Technical Requirements:**
- POST /api/v1/producers/onboard endpoint
- AWS SES integration for welcome email
- BCrypt or similar for API key hashing
- Database: `producers` table insert

**Story Points:** 5

**Dependencies:** None

**Labels:** backend, api, security, producer-onboarding

---

### WH-002: Schema Registration with Registry Integration

**As a** producer
**I want to** register an event schema in the Schema Registry
**So that** subscribers can discover my events and payloads are validated

**Acceptance Criteria:**
- [ ] Producer can register schema with name, event type, version, schema definition (JSON Schema format), and description
- [ ] System validates API key before allowing schema registration
- [ ] Schema is registered in AWS Glue Schema Registry and DB simultaneously
- [ ] Schema Registry ARN is stored in webhook database
- [ ] Duplicate event types are rejected
- [ ] Schema can be marked as public (visible to all) or private (approval required)
- [ ] Producer can view all their registered schemas
- [ ] Schema version increments are supported (1.0.0 → 1.1.0)
- [ ] Producer's total_schemas_registered counter increments

**Technical Requirements:**
- POST /api/v1/schemas/register endpoint
- AWS Glue Schema Registry client integration
- JSON Schema validation (Ajv library)
- Database: `schemas` table insert
- Foreign key relationship to `producers` table

**Story Points:** 8

**Dependencies:** WH-001

**Labels:** backend, api, aws-glue, schema-registry, validation

---

### WH-003: Schema Marketplace for Discovery

**As a** subscriber
**I want to** browse available public schemas in a marketplace
**So that** I can discover events I want to subscribe to

**Acceptance Criteria:**
- [ ] Subscriber can list all public schemas without authentication
- [ ] Response includes schema name, event type, version, description, producer name
- [ ] Schemas are paginated (default 20 per page, max 100)
- [ ] Results can be filtered by event type prefix (e.g., "order.*")
- [ ] Results can be sorted by subscription_count, created_at
- [ ] Each schema shows current subscription count
- [ ] Schema definition is viewable in JSON format
- [ ] Documentation URL is displayed if available

**Technical Requirements:**
- GET /api/v1/schemas/marketplace endpoint
- Query parameters: page, limit, eventType, sortBy
- Database: JOIN schemas and producers tables
- WHERE is_public = true AND status = 'active'

**Story Points:** 3

**Dependencies:** WH-002

**Labels:** backend, api, marketplace, discovery

---

### WH-004: Schema Validation Endpoint

**As a** producer
**I want to** validate my event payload against a schema before publishing
**So that** I can catch validation errors early in development

**Acceptance Criteria:**
- [ ] Producer can submit payload and schema ID for validation
- [ ] System validates payload against AWS Glue Schema Registry version
- [ ] Returns validation result: valid (true/false) and list of errors
- [ ] Errors include JSON path to invalid fields
- [ ] Validation uses the latest schema version by default
- [ ] Producer can optionally specify schema version number
- [ ] Response time < 500ms for typical payloads

**Technical Requirements:**
- POST /api/v1/schemas/{schemaId}/validate endpoint
- AWS Glue GetSchemaVersion API call
- Ajv validation with detailed error reporting
- No database writes (read-only operation)

**Story Points:** 5

**Dependencies:** WH-002

**Labels:** backend, api, validation, developer-experience

---

## Epic 2: Subscriber Management & API Exchange

### WH-005: Subscriber Onboarding

**As a** partner organization
**I want to** register as a subscriber
**So that** I can receive webhook events from producers

**Acceptance Criteria:**
- [ ] Subscriber can submit registration with name, email, webhook URL (optional), contact name
- [ ] System generates unique API key for the subscriber
- [ ] API key is displayed only once
- [ ] Subscriber receives welcome email with API key and documentation
- [ ] Webhook URL format is validated (must be HTTPS in production)
- [ ] Subscriber status defaults to "active"
- [ ] API returns 201 status with subscriber ID and API key

**Technical Requirements:**
- POST /api/v1/subscribers/onboard endpoint (or reuse producers endpoint)
- URL validation regex
- AWS SES for welcome email
- Database: `subscribers` table insert

**Story Points:** 3

**Dependencies:** None

**Labels:** backend, api, subscriber-management

---

### WH-006: Create Subscription to Schema

**As a** subscriber
**I want to** subscribe to an event schema
**So that** I receive webhook notifications when events are published

**Acceptance Criteria:**
- [ ] Subscriber can create subscription by providing schema ID and webhook URL
- [ ] System validates subscriber API key
- [ ] Webhook secret is automatically generated for signature verification
- [ ] Subscriber can configure max retries (default: 3, max: 10)
- [ ] Subscriber can choose backoff strategy: exponential, linear, constant (default: exponential)
- [ ] Subscription is created with status "active"
- [ ] Confirmation email is sent with webhook secret and signature verification code example
- [ ] Schema's subscription_count is incremented
- [ ] Duplicate subscriptions (same subscriber + schema) are rejected

**Technical Requirements:**
- POST /api/v1/subscriptions/subscribe endpoint
- Generate random webhook secret (256-bit)
- AWS SES for confirmation email with HMAC-SHA256 example code
- Database: `subscriptions` table insert
- Database trigger: update schema subscription_count

**Story Points:** 8

**Dependencies:** WH-002, WH-005

**Labels:** backend, api, subscription-management, security

---

### WH-007: Manage Subscriptions

**As a** subscriber
**I want to** view, update, and delete my subscriptions
**So that** I can manage which events I receive

**Acceptance Criteria:**
- [ ] Subscriber can list all their subscriptions with pagination
- [ ] Each subscription shows schema name, event type, status, webhook URL
- [ ] Subscriber can get details of a single subscription
- [ ] Subscriber can update webhook URL, max retries, backoff strategy
- [ ] Subscriber can pause subscription (status: paused) without deleting
- [ ] Subscriber can delete subscription (soft delete)
- [ ] Deleting subscription decrements schema subscription_count
- [ ] Cannot view or modify other subscribers' subscriptions (authorization check)

**Technical Requirements:**
- GET /api/v1/subscriptions (list)
- GET /api/v1/subscriptions/{id} (details)
- PATCH /api/v1/subscriptions/{id} (update)
- DELETE /api/v1/subscriptions/{id} (soft delete)
- Authorization: validate API key matches subscription owner

**Story Points:** 5

**Dependencies:** WH-006

**Labels:** backend, api, subscription-management, crud

---

### WH-008: Subscription Approval Workflow (Private Schemas)

**As a** producer with private schemas
**I want to** approve subscription requests
**So that** I control who can receive my sensitive events

**Acceptance Criteria:**
- [ ] When subscriber requests private schema, subscription status is "pending_approval"
- [ ] Producer receives email notification of subscription request
- [ ] Producer can approve or reject subscription via API or email link
- [ ] Upon approval, subscription status changes to "active" and subscriber receives confirmation
- [ ] Upon rejection, subscriber receives rejection email with optional reason
- [ ] Pending subscriptions expire after 7 days if not approved
- [ ] Producer can view all pending approval requests

**Technical Requirements:**
- Approval workflow state machine
- Email templates for request, approval, rejection
- GET /api/v1/schemas/approvals (list pending)
- POST /api/v1/schemas/approvals/{id}/approve
- POST /api/v1/schemas/approvals/{id}/reject
- Database: `schema_approvals` table

**Story Points:** 8

**Dependencies:** WH-006

**Labels:** backend, api, approval-workflow, private-schemas

---

## Epic 3: Event Publishing & Delivery System

### WH-009: Publish Event with Schema Validation

**As a** producer
**I want to** publish events to all subscribers
**So that** they receive real-time notifications via webhooks

**Acceptance Criteria:**
- [ ] Producer can publish event with event type, payload, and optional idempotency key
- [ ] System validates API key before accepting event
- [ ] Event type is matched to registered schema
- [ ] Payload is validated against schema definition in AWS Glue Registry
- [ ] Validation errors return 422 status with detailed error messages
- [ ] System fetches all active subscriptions for the schema
- [ ] Event is recorded in event_messages table with unique event_id
- [ ] Delivery message is published to Kafka for each subscription
- [ ] Response returns event_id, subscriber_count, deliveries_queued
- [ ] Response status is 202 Accepted (async processing)
- [ ] Idempotency key prevents duplicate event publishing

**Technical Requirements:**
- POST /api/v1/events/publish endpoint
- AWS Glue validation
- Kafka producer to `delivery-messages` topic
- Database: `event_messages` table insert
- Database: `delivery_logs` table insert for each subscription
- Idempotency check using `idempotency_key`

**Story Points:** 13

**Dependencies:** WH-002, WH-006

**Labels:** backend, api, event-publishing, kafka, validation

---

### WH-010: Webhook Delivery via Egress Gateway

**As a** system
**I want to** deliver webhook events to subscriber URLs
**So that** subscribers receive event notifications

**Acceptance Criteria:**
- [ ] Delivery consumer reads from Kafka `delivery-messages` topic
- [ ] Updates delivery_log status to "delivering" before attempting delivery
- [ ] Constructs HTTP POST request with payload and custom headers
- [ ] Adds X-Webhook-Signature header with HMAC-SHA256 signature
- [ ] Adds X-Webhook-Event-Type, X-Webhook-Event-Id headers
- [ ] Respects timeout configuration (default 30 seconds)
- [ ] Successful delivery (2xx status) updates status to "success"
- [ ] Records response status code, latency, response body
- [ ] Updates subscriber delivery statistics (success_count, last_success_at)
- [ ] Increments event_messages.deliveries_completed counter
- [ ] Failed deliveries trigger retry logic (see WH-011)

**Technical Requirements:**
- Lambda: `delivery-consumer`
- Kafka consumer for `delivery-messages` topic
- Axios HTTP client with timeout
- HMAC-SHA256 signature generation
- Database updates to `delivery_logs` table
- Circuit breaker pattern for failing endpoints

**Story Points:** 13

**Dependencies:** WH-009

**Labels:** backend, lambda, kafka-consumer, egress-gateway, http-delivery

---

### WH-011: Webhook Signature Verification Documentation

**As a** subscriber
**I want to** verify webhook signatures
**So that** I can ensure webhooks are authentic and not tampered with

**Acceptance Criteria:**
- [ ] Documentation includes HMAC-SHA256 signature algorithm
- [ ] Code examples provided in: Node.js, Python, Java, Ruby, Go
- [ ] Explains X-Webhook-Signature header format
- [ ] Explains X-Webhook-Timestamp header for replay attack prevention
- [ ] Example payload verification code is included
- [ ] Security best practices: always verify signature, use HTTPS, rotate secrets
- [ ] Test signature validation tool available in API docs

**Technical Requirements:**
- Documentation page in /docs/WEBHOOK_SIGNATURE_VERIFICATION.md
- Code examples in multiple languages
- Optional: Interactive signature validator tool

**Story Points:** 3

**Dependencies:** WH-010

**Labels:** documentation, security, developer-experience

---

## Epic 4: Retry Logic & Dead Letter Queue

### WH-012: Automatic Retry with Exponential Backoff

**As a** system
**I want to** automatically retry failed webhook deliveries
**So that** temporary failures don't result in lost events

**Acceptance Criteria:**
- [ ] Failed deliveries (5xx, timeout, network errors) are categorized as retryable
- [ ] Non-retryable errors (4xx except 429) are not retried
- [ ] Retry message is published to Kafka `retry-messages` topic
- [ ] Next retry time is calculated based on backoff strategy:
  - Exponential: delay = initial_delay * 2^attempt (e.g., 30s, 60s, 120s, 240s)
  - Linear: delay = initial_delay * attempt (e.g., 30s, 60s, 90s, 120s)
  - Constant: delay = initial_delay (e.g., 30s, 30s, 30s, 30s)
- [ ] Delivery status updated to "retrying" with next_retry_at timestamp
- [ ] Retry attempt counter increments
- [ ] Status notification published to `status-notifications` topic
- [ ] Max retries defaults to 3, configurable per subscription (max 10)

**Technical Requirements:**
- Error categorization logic in egress gateway
- Kafka producer to `retry-messages` topic
- Calculate next retry timestamp
- Database: update `delivery_logs` with retry info

**Story Points:** 8

**Dependencies:** WH-010

**Labels:** backend, lambda, retry-logic, kafka, resilience

---

### WH-013: Retry Consumer Processing

**As a** system
**I want to** process retry messages at the scheduled time
**So that** failed deliveries are retried automatically

**Acceptance Criteria:**
- [ ] Retry consumer reads from Kafka `retry-messages` topic
- [ ] Checks if current time >= next_retry_at before processing
- [ ] If not ready, skips message (will be redelivered by Kafka)
- [ ] If ready and within retry limit, republishes to `delivery-messages` topic
- [ ] If max retries exceeded, moves to dead letter queue
- [ ] Updates delivery_log status to "failed" for DLQ cases
- [ ] Publishes permanent failure notification to `status-notifications` topic
- [ ] Records total attempts in DLQ record

**Technical Requirements:**
- Lambda: `delivery-retry-consumer`
- Kafka consumer for `retry-messages` topic
- Kafka producer to `delivery-messages` topic (for retries)
- Kafka producer to `dlq-messages` topic (for failures)
- Database: insert into `delivery_dlq` table
- Database: update `delivery_logs` status

**Story Points:** 8

**Dependencies:** WH-012

**Labels:** backend, lambda, kafka-consumer, retry-logic, dlq

---

### WH-014: Dead Letter Queue Management

**As a** system administrator
**I want to** view and manage permanently failed deliveries
**So that** I can investigate and manually retry if needed

**Acceptance Criteria:**
- [ ] Failed deliveries moved to `delivery_dlq` table after max retries
- [ ] DLQ records include all delivery metadata, error messages, total attempts
- [ ] Admin can query DLQ via API with filters (subscriber, event type, date range)
- [ ] Admin can view DLQ entry details including full payload
- [ ] Admin can manually retry DLQ entry (republishes to `delivery-messages`)
- [ ] Admin can mark DLQ entry as resolved (no action)
- [ ] DLQ entries older than 30 days are archived
- [ ] Dashboard shows DLQ count per subscriber

**Technical Requirements:**
- GET /api/v1/admin/dlq endpoint (list with filters)
- GET /api/v1/admin/dlq/{id} endpoint (details)
- POST /api/v1/admin/dlq/{id}/retry endpoint
- POST /api/v1/admin/dlq/{id}/resolve endpoint
- Database: queries on `delivery_dlq` table
- Admin authentication/authorization required

**Story Points:** 8

**Dependencies:** WH-013

**Labels:** backend, api, admin, dlq-management

---

### WH-015: Delivery Status Notifications

**As a** system
**I want to** send status notifications for important delivery events
**So that** producers and subscribers are informed of issues

**Acceptance Criteria:**
- [ ] Notification published to Kafka `status-notifications` topic on:
  - delivery_failed (retryable failure, will retry)
  - delivery_permanently_failed (moved to DLQ)
  - delivery_success (optional, for monitoring)
- [ ] Notification includes: delivery_id, event_id, subscription_id, error details
- [ ] Status notification consumer sends email alerts:
  - To subscriber: when their endpoint fails 3+ times in 1 hour
  - To producer: when event fails to deliver to all subscribers
- [ ] Email includes error message, troubleshooting tips, DLQ link
- [ ] Rate limiting: max 1 alert email per subscriber per hour

**Technical Requirements:**
- Kafka producer to `status-notifications` topic (in delivery consumers)
- Lambda: `status-notification-consumer`
- AWS SES for alert emails
- Redis or DynamoDB for rate limiting tracking
- Database: `notification_logs` table

**Story Points:** 8

**Dependencies:** WH-012, WH-013

**Labels:** backend, lambda, notifications, kafka-consumer, alerting

---

## Epic 5: Infrastructure & DevOps

### WH-016: Database Schema & Migrations

**As a** developer
**I want to** have a well-designed database schema
**So that** data is stored efficiently and relationships are maintained

**Acceptance Criteria:**
- [ ] All 9 tables created with proper constraints:
  - producers, schemas, subscribers, subscriptions
  - event_messages, delivery_logs, delivery_dlq
  - schema_approvals, notification_logs
- [ ] Foreign key relationships enforce referential integrity
- [ ] Indexes created on frequently queried columns:
  - delivery_logs.event_id, delivery_logs.subscription_id
  - subscriptions.schema_id, subscriptions.subscriber_id
  - event_messages.producer_id, event_messages.event_type
- [ ] Database triggers auto-update timestamps and counters
- [ ] Migration scripts are idempotent and versioned
- [ ] Rollback scripts provided for each migration

**Technical Requirements:**
- SQL migration files: 001_initial_schema.sql, 002_enhanced_schema.sql
- PostgreSQL 15+ compatibility
- Flyway or Liquibase for migration management (optional)

**Story Points:** 5

**Dependencies:** None

**Labels:** database, devops, migrations, postgresql

---

### WH-017: Kafka Topic Configuration

**As a** DevOps engineer
**I want to** configure Kafka topics with proper partitioning and retention
**So that** the system handles high throughput reliably

**Acceptance Criteria:**
- [ ] 4 Kafka topics created:
  - `delivery-messages` (3 partitions, 7 day retention)
  - `retry-messages` (3 partitions, 14 day retention)
  - `dlq-messages` (1 partition, 30 day retention)
  - `status-notifications` (1 partition, 7 day retention)
- [ ] Partitioning strategy: hash by deliveryId for ordering
- [ ] Replication factor: 3 (production), 1 (local dev)
- [ ] Consumer groups configured with proper offsets management
- [ ] Dead letter topics created for each consumer (Kafka-level DLQ)

**Technical Requirements:**
- Terraform or CloudFormation for AWS MSK topic creation
- Kafka configuration files for local development
- Documentation: KAFKA_TOPICS.md

**Story Points:** 5

**Dependencies:** None

**Labels:** infrastructure, kafka, devops, aws-msk

---

### WH-018: Lambda Functions Deployment

**As a** DevOps engineer
**I want to** deploy all Lambda functions with proper IAM roles
**So that** the system runs securely in AWS

**Acceptance Criteria:**
- [ ] 6 Lambda functions deployed:
  - producer-onboarding, schema-admin, subscription-admin
  - event-publisher, delivery-consumer, delivery-retry-consumer
- [ ] Each Lambda has appropriate IAM role with least privilege:
  - RDS access (read/write)
  - Kafka access (produce/consume specific topics)
  - Secrets Manager access (database credentials)
  - SES send email permissions
  - Glue Schema Registry access
- [ ] Environment variables configured per function
- [ ] Lambda timeout: 30s (API functions), 5min (consumers)
- [ ] Memory: 512MB (API), 1024MB (consumers)
- [ ] VPC configuration for RDS and MSK access
- [ ] CloudWatch Logs retention: 30 days

**Technical Requirements:**
- Terraform or CloudFormation templates
- Lambda deployment packages (ZIP files)
- CI/CD pipeline for automated deployment

**Story Points:** 13

**Dependencies:** WH-016, WH-017

**Labels:** infrastructure, lambda, devops, aws, iam, security

---

### WH-019: API Gateway Configuration

**As a** DevOps engineer
**I want to** configure API Gateway with proper routing and throttling
**So that** the REST API is production-ready

**Acceptance Criteria:**
- [ ] API Gateway REST API created with custom domain
- [ ] All endpoints routed to correct Lambda functions
- [ ] Request validation enabled (schema validation)
- [ ] CORS configured for frontend access
- [ ] Throttling: 1000 requests/second per API key
- [ ] Burst limit: 2000 requests
- [ ] Usage plans created for different tiers (free, standard, premium)
- [ ] API keys managed through API Gateway
- [ ] CloudWatch metrics enabled
- [ ] Access logs sent to CloudWatch Logs

**Technical Requirements:**
- API Gateway REST API or HTTP API
- Lambda integrations for all routes
- Request/response transformations
- API key management
- Usage plans and quotas

**Story Points:** 8

**Dependencies:** WH-018

**Labels:** infrastructure, api-gateway, devops, aws

---

### WH-020: Monitoring & Observability

**As a** DevOps engineer
**I want to** monitor system health and performance
**So that** I can detect and resolve issues quickly

**Acceptance Criteria:**
- [ ] CloudWatch dashboards created showing:
  - API request rate, latency (P50, P95, P99), error rate
  - Lambda invocation count, duration, errors
  - Kafka consumer lag per topic
  - Database connection pool usage
  - Delivery success rate per subscriber
  - DLQ message count
- [ ] CloudWatch alarms configured for:
  - API error rate > 5%
  - Lambda errors > 10 in 5 minutes
  - Kafka consumer lag > 1000 messages
  - Database connection exhaustion
  - Delivery failure rate > 20%
- [ ] Alarms send notifications to SNS topic
- [ ] X-Ray tracing enabled for API requests
- [ ] Structured JSON logging in all Lambda functions

**Technical Requirements:**
- CloudWatch dashboards JSON definition
- CloudWatch alarms via Terraform/CloudFormation
- SNS topic for alerts
- X-Ray SDK integration
- Winston or Pino for structured logging

**Story Points:** 8

**Dependencies:** WH-018, WH-019

**Labels:** monitoring, observability, cloudwatch, x-ray, alerting

---

### WH-021: Local Development Environment

**As a** developer
**I want to** run the entire system locally
**So that** I can develop and test without deploying to AWS

**Acceptance Criteria:**
- [ ] Docker Compose file includes PostgreSQL, Kafka, Zookeeper
- [ ] Database migrations run automatically on container startup
- [ ] Kafka topics auto-created on startup
- [ ] Local server runs all Lambda functions as Express endpoints
- [ ] Local consumers run as Node.js processes
- [ ] .env.local file with local configuration
- [ ] Setup script automates entire setup process
- [ ] Kafka UI available for topic monitoring
- [ ] pgAdmin available for database management
- [ ] Documentation: LOCAL_DEVELOPMENT.md with examples

**Technical Requirements:**
- docker-compose.yml file
- local-server.ts (Express wrapper for Lambdas)
- local-consumer.ts and local-retry-consumer.ts
- setup-local.sh script
- Full documentation with curl examples

**Story Points:** 8

**Dependencies:** None

**Labels:** devops, local-development, docker, developer-experience

---

### WH-022: CI/CD Pipeline

**As a** developer
**I want to** automated testing and deployment
**So that** code changes are validated and deployed safely

**Acceptance Criteria:**
- [ ] GitHub Actions or GitLab CI pipeline configured
- [ ] Pipeline stages:
  1. Lint (ESLint, Prettier)
  2. Type check (TypeScript)
  3. Unit tests (Jest) with coverage report
  4. Integration tests against local Docker stack
  5. Build Lambda packages
  6. Deploy to dev environment (auto on main branch)
  7. Deploy to staging (manual approval)
  8. Deploy to production (manual approval)
- [ ] PR checks must pass before merge
- [ ] Test coverage minimum: 70%
- [ ] Deployment uses blue-green strategy for zero downtime
- [ ] Rollback mechanism available

**Technical Requirements:**
- .github/workflows/ci-cd.yml or .gitlab-ci.yml
- Jest test suites
- Terraform/CloudFormation for infrastructure as code
- Deployment scripts

**Story Points:** 13

**Dependencies:** WH-018, WH-021

**Labels:** devops, ci-cd, testing, automation, deployment

---

## Epic 6: Additional Features & Enhancements

### WH-023: Delivery Analytics Dashboard

**As a** producer
**I want to** view analytics for my events
**So that** I can monitor delivery performance

**Acceptance Criteria:**
- [ ] Dashboard shows:
  - Total events published (today, week, month)
  - Delivery success rate per schema
  - Average delivery latency
  - Top failing subscribers
  - Retry rate
- [ ] Data aggregated from delivery_logs table
- [ ] Filters: date range, event type, subscriber
- [ ] Export data as CSV
- [ ] Refresh every 5 minutes

**Technical Requirements:**
- GET /api/v1/analytics/events endpoint
- SQL aggregation queries with date_trunc
- Optional: Materialized views for performance
- Optional: Frontend dashboard (React)

**Story Points:** 8

**Dependencies:** WH-009, WH-010

**Labels:** backend, api, analytics, reporting

---

### WH-024: Webhook Testing Tool

**As a** subscriber
**I want to** test my webhook endpoint before going live
**So that** I can ensure it handles events correctly

**Acceptance Criteria:**
- [ ] Subscriber can send test webhook to their URL
- [ ] Test payload follows schema definition
- [ ] System sends real webhook with signature
- [ ] Response shows: status code, latency, response body
- [ ] Test deliveries are not logged in production tables
- [ ] Rate limit: 10 tests per hour per subscriber

**Technical Requirements:**
- POST /api/v1/subscriptions/{id}/test endpoint
- Reuse egress gateway code
- No database logging (or separate test_logs table)
- Rate limiting via Redis or API Gateway

**Story Points:** 5

**Dependencies:** WH-006, WH-010

**Labels:** backend, api, testing, developer-experience

---

### WH-025: Webhook Event Filtering

**As a** subscriber
**I want to** filter events based on payload fields
**So that** I only receive relevant events

**Acceptance Criteria:**
- [ ] Subscriber can define filter rules when subscribing (e.g., `payload.amount > 100`)
- [ ] Filter syntax supports:
  - Equality: `payload.status == "completed"`
  - Comparison: `payload.amount >= 50`
  - Contains: `payload.tags contains "urgent"`
  - Logical: `payload.priority == "high" AND payload.amount > 1000`
- [ ] Event publisher evaluates filters before queuing delivery
- [ ] Filtered out deliveries are not queued (reduces load)
- [ ] Filter validation at subscription creation time

**Technical Requirements:**
- Filter expression parser (JSONPath or custom DSL)
- Evaluation engine in event-publisher Lambda
- Database: `subscriptions.filter_rules` column (JSONB)
- Validation library for filter syntax

**Story Points:** 13

**Dependencies:** WH-006, WH-009

**Labels:** backend, feature, filtering, advanced

---

### WH-026: Webhook Event Transformation

**As a** subscriber
**I want to** transform event payloads to match my system's format
**So that** I don't need a custom adapter

**Acceptance Criteria:**
- [ ] Subscriber can define transformation template (JSONata or similar)
- [ ] Transformation applied before delivery
- [ ] Template can:
  - Rename fields: `{"orderId": "order.id"}`
  - Calculate values: `{"total": "amount + tax"}`
  - Conditional logic: `{"status": "amount > 100 ? 'high' : 'low'"}`
- [ ] Transformation errors log to DLQ (no retries)
- [ ] Test transformation during subscription setup

**Technical Requirements:**
- JSONata library for transformations
- Database: `subscriptions.transformation_template` column (JSONB)
- Transformation execution in delivery-consumer
- Validation at subscription creation

**Story Points:** 13

**Dependencies:** WH-006, WH-010

**Labels:** backend, feature, transformation, advanced

---

### WH-027: Multi-region Failover

**As a** system
**I want to** support multi-region deployment
**So that** the system is highly available

**Acceptance Criteria:**
- [ ] System deployed in 2+ AWS regions
- [ ] Route 53 health checks monitor API Gateway endpoints
- [ ] Automatic failover to secondary region if primary unhealthy
- [ ] Database uses Aurora Global Database for cross-region replication
- [ ] Kafka uses MirrorMaker 2 for topic replication
- [ ] RPO (Recovery Point Objective): < 1 minute
- [ ] RTO (Recovery Time Objective): < 5 minutes

**Technical Requirements:**
- Multi-region Terraform/CloudFormation
- Aurora Global Database
- Kafka MirrorMaker 2 configuration
- Route 53 health checks and failover routing

**Story Points:** 21

**Dependencies:** WH-016, WH-017, WH-018

**Labels:** infrastructure, high-availability, disaster-recovery, multi-region

---

## Summary

### Story Points by Epic

| Epic | Story Count | Total Story Points |
|------|-------------|-------------------|
| Epic 1: Producer Onboarding & Schema Management | 4 | 21 |
| Epic 2: Subscriber Management & API Exchange | 4 | 24 |
| Epic 3: Event Publishing & Delivery System | 3 | 29 |
| Epic 4: Retry Logic & Dead Letter Queue | 4 | 32 |
| Epic 5: Infrastructure & DevOps | 7 | 68 |
| Epic 6: Additional Features & Enhancements | 5 | 68 |
| **TOTAL** | **27** | **242** |

### Sprint Recommendations

**Sprint 1 (Core MVP - 34 points):**
- WH-001, WH-002, WH-005, WH-006, WH-016, WH-017

**Sprint 2 (Event Publishing - 39 points):**
- WH-003, WH-004, WH-009, WH-021

**Sprint 3 (Delivery System - 34 points):**
- WH-007, WH-010, WH-011, WH-018 (partial)

**Sprint 4 (Retry & DLQ - 32 points):**
- WH-012, WH-013, WH-014, WH-015

**Sprint 5 (Infrastructure - 29 points):**
- WH-018 (complete), WH-019, WH-020

**Sprint 6 (CI/CD & Enhancements - 29 points):**
- WH-008, WH-022, WH-023, WH-024

**Sprint 7+ (Advanced Features - 45 points):**
- WH-025, WH-026, WH-027

---

## Estimation Guidelines

**Story Point Scale (Fibonacci):**
- **1 point:** Trivial change (< 2 hours)
- **3 points:** Simple feature (< 1 day)
- **5 points:** Moderate feature (1-2 days)
- **8 points:** Complex feature (3-5 days)
- **13 points:** Very complex feature (1 week)
- **21 points:** Epic-sized (needs breakdown)

**Velocity Assumptions:**
- Team of 3 developers
- 2-week sprints
- Expected velocity: 30-40 points per sprint
