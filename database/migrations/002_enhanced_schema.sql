-- Enhanced Webhook Management System - Schema Registry & Subscription Model
-- PostgreSQL 15+
-- Migration: 002_enhanced_schema
-- Created: 2025-09-30

-- ============================================================================
-- PRODUCERS TABLE (Message Publishers)
-- ============================================================================
CREATE TABLE producers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    api_key_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA256 hash for lookup
    contact_email VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    department VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),

    -- Metrics
    total_events_published BIGINT DEFAULT 0,
    total_schemas_registered INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_published_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_producers_api_key_hash ON producers(api_key_hash);
CREATE INDEX idx_producers_status ON producers(status);
CREATE INDEX idx_producers_contact_email ON producers(contact_email);

-- ============================================================================
-- SCHEMAS TABLE (Enhanced with Schema Registry)
-- ============================================================================
CREATE TABLE schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producer_id UUID NOT NULL REFERENCES producers(id) ON DELETE CASCADE,

    -- Schema Registry Integration
    schema_registry_id VARCHAR(255) UNIQUE, -- AWS Glue or Confluent Schema Registry ID
    schema_registry_version INTEGER,

    -- Schema Metadata
    name VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL UNIQUE, -- e.g., "order.created"
    version VARCHAR(50) NOT NULL, -- Semantic version (e.g., "1.0.0")
    schema_format VARCHAR(50) DEFAULT 'json' CHECK (schema_format IN ('json', 'avro', 'protobuf')),
    schema_definition JSONB NOT NULL,

    -- Schema Configuration
    is_public BOOLEAN DEFAULT false,
    requires_approval BOOLEAN DEFAULT false,
    compatibility_mode VARCHAR(50) DEFAULT 'backward' CHECK (
        compatibility_mode IN ('none', 'backward', 'forward', 'full', 'backward_transitive', 'forward_transitive', 'full_transitive')
    ),

    -- Documentation
    description TEXT,
    documentation_url VARCHAR(2048),
    example_payload JSONB,

    -- Metrics
    subscription_count INTEGER DEFAULT 0,
    total_events_published BIGINT DEFAULT 0,

    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'disabled')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deprecated_at TIMESTAMP WITH TIME ZONE,

    UNIQUE(event_type, version)
);

CREATE INDEX idx_schemas_producer_id ON schemas(producer_id);
CREATE INDEX idx_schemas_event_type ON schemas(event_type);
CREATE INDEX idx_schemas_schema_registry_id ON schemas(schema_registry_id);
CREATE INDEX idx_schemas_is_public ON schemas(is_public);
CREATE INDEX idx_schemas_status ON schemas(status);

-- ============================================================================
-- SUBSCRIBERS TABLE (Partners/External Systems)
-- ============================================================================
CREATE TABLE subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    email VARCHAR(255) NOT NULL UNIQUE,

    -- Authentication
    api_key VARCHAR(255) UNIQUE NOT NULL,
    api_key_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA256 hash for lookup

    -- Webhook Configuration
    webhook_url VARCHAR(2048) NOT NULL,
    webhook_secret VARCHAR(255) NOT NULL, -- For HMAC signature verification

    -- Contact Information
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),

    -- Configuration
    auth_type VARCHAR(50) DEFAULT 'hmac' CHECK (auth_type IN ('none', 'hmac', 'mtls', 'oauth2')),
    ip_whitelist TEXT[], -- Array of whitelisted IPs

    -- Metrics
    total_subscriptions INTEGER DEFAULT 0,
    total_deliveries BIGINT DEFAULT 0,
    successful_deliveries BIGINT DEFAULT 0,
    failed_deliveries BIGINT DEFAULT 0,

    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_delivery_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_subscribers_api_key_hash ON subscribers(api_key_hash);
CREATE INDEX idx_subscribers_email ON subscribers(email);
CREATE INDEX idx_subscribers_status ON subscribers(status);

-- ============================================================================
-- SUBSCRIPTIONS TABLE (Schema Subscriptions)
-- ============================================================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
    schema_id UUID NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,

    -- Webhook Configuration (can override subscriber defaults)
    webhook_url VARCHAR(2048) NOT NULL,
    webhook_secret VARCHAR(255) NOT NULL,

    -- Authentication
    auth_type VARCHAR(50) DEFAULT 'hmac',
    auth_config JSONB,
    custom_headers JSONB,

    -- Delivery Configuration
    enabled BOOLEAN DEFAULT true,
    max_retries INTEGER DEFAULT 3 CHECK (max_retries >= 0 AND max_retries <= 10),
    backoff_strategy VARCHAR(50) DEFAULT 'exponential' CHECK (backoff_strategy IN ('exponential', 'linear', 'constant')),
    initial_delay_ms INTEGER DEFAULT 1000 CHECK (initial_delay_ms >= 100),
    timeout_ms INTEGER DEFAULT 30000 CHECK (timeout_ms >= 1000 AND timeout_ms <= 300000),

    -- Filters (optional payload filtering)
    payload_filter JSONB, -- JSONPath expressions to filter events

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'suspended', 'cancelled')),

    -- Metrics (denormalized for performance)
    total_deliveries BIGINT DEFAULT 0,
    successful_deliveries BIGINT DEFAULT 0,
    failed_deliveries BIGINT DEFAULT 0,
    avg_latency_ms INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,
    last_delivery_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,

    -- Circuit Breaker
    circuit_breaker_open_until TIMESTAMP WITH TIME ZONE,

    -- Approval (if schema requires approval)
    approval_status VARCHAR(50) DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP WITH TIME ZONE,

    UNIQUE(subscriber_id, schema_id)
);

CREATE INDEX idx_subscriptions_subscriber_id ON subscriptions(subscriber_id);
CREATE INDEX idx_subscriptions_schema_id ON subscriptions(schema_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_enabled ON subscriptions(enabled);
CREATE INDEX idx_subscriptions_approval_status ON subscriptions(approval_status);

-- ============================================================================
-- EVENT_MESSAGES TABLE (Published Events)
-- ============================================================================
CREATE TABLE event_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    producer_id UUID NOT NULL REFERENCES producers(id) ON DELETE CASCADE,
    schema_id UUID NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,

    -- Event Data
    event_type VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,

    -- Metadata
    correlation_id VARCHAR(255), -- For tracing
    idempotency_key VARCHAR(255), -- For deduplication

    -- Delivery Tracking
    subscriber_count INTEGER DEFAULT 0,
    deliveries_queued INTEGER DEFAULT 0,
    deliveries_completed INTEGER DEFAULT 0,
    deliveries_failed INTEGER DEFAULT 0,

    published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_event_messages_event_id ON event_messages(event_id);
CREATE INDEX idx_event_messages_producer_id ON event_messages(producer_id);
CREATE INDEX idx_event_messages_schema_id ON event_messages(schema_id);
CREATE INDEX idx_event_messages_event_type ON event_messages(event_type);
CREATE INDEX idx_event_messages_published_at ON event_messages(published_at DESC);
CREATE INDEX idx_event_messages_idempotency_key ON event_messages(idempotency_key);
CREATE INDEX idx_event_messages_correlation_id ON event_messages(correlation_id);

-- ============================================================================
-- DELIVERY_LOGS TABLE (Enhanced Execution Logs)
-- ============================================================================
CREATE TABLE delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id VARCHAR(255) UNIQUE NOT NULL,
    event_id VARCHAR(255) REFERENCES event_messages(event_id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,

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
    status VARCHAR(50) NOT NULL CHECK (status IN ('queued', 'delivering', 'success', 'failed', 'retrying', 'timeout', 'cancelled')),
    retry_attempt INTEGER DEFAULT 0,
    latency_ms INTEGER,
    error_message TEXT,
    error_code VARCHAR(100),
    error_category VARCHAR(50), -- network, timeout, 4xx, 5xx, validation

    -- Timestamps
    queued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_delivery_logs_delivery_id ON delivery_logs(delivery_id);
CREATE INDEX idx_delivery_logs_event_id ON delivery_logs(event_id);
CREATE INDEX idx_delivery_logs_subscription_id ON delivery_logs(subscription_id);
CREATE INDEX idx_delivery_logs_subscriber_id ON delivery_logs(subscriber_id);
CREATE INDEX idx_delivery_logs_status ON delivery_logs(status);
CREATE INDEX idx_delivery_logs_created_at ON delivery_logs(created_at DESC);
CREATE INDEX idx_delivery_logs_next_retry_at ON delivery_logs(next_retry_at) WHERE status = 'retrying';

-- ============================================================================
-- DELIVERY_DLQ TABLE (Dead Letter Queue)
-- ============================================================================
CREATE TABLE delivery_dlq (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id VARCHAR(255) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,

    -- Original Request
    request_url VARCHAR(2048),
    request_payload JSONB,
    request_headers JSONB,

    -- Failure Details
    final_error_message TEXT,
    final_error_code VARCHAR(100),
    final_error_category VARCHAR(50),
    total_attempts INTEGER,
    first_attempt_at TIMESTAMP WITH TIME ZONE,
    last_attempt_at TIMESTAMP WITH TIME ZONE,

    -- Investigation
    investigated BOOLEAN DEFAULT false,
    resolution_notes TEXT,
    resolved_by UUID,
    assigned_to UUID,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_delivery_dlq_delivery_id ON delivery_dlq(delivery_id);
CREATE INDEX idx_delivery_dlq_event_id ON delivery_dlq(event_id);
CREATE INDEX idx_delivery_dlq_subscription_id ON delivery_dlq(subscription_id);
CREATE INDEX idx_delivery_dlq_subscriber_id ON delivery_dlq(subscriber_id);
CREATE INDEX idx_delivery_dlq_investigated ON delivery_dlq(investigated);
CREATE INDEX idx_delivery_dlq_created_at ON delivery_dlq(created_at DESC);

-- ============================================================================
-- SCHEMA_APPROVALS TABLE (for restricted schemas)
-- ============================================================================
CREATE TABLE schema_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_id UUID NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,

    -- Request Details
    justification TEXT,
    use_case TEXT,

    -- Approval Details
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID,
    review_notes TEXT,

    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,

    UNIQUE(schema_id, requested_by, status)
);

CREATE INDEX idx_schema_approvals_schema_id ON schema_approvals(schema_id);
CREATE INDEX idx_schema_approvals_requested_by ON schema_approvals(requested_by);
CREATE INDEX idx_schema_approvals_status ON schema_approvals(status);

-- ============================================================================
-- NOTIFICATION_LOGS TABLE (Email/SNS Notifications)
-- ============================================================================
CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_type VARCHAR(50) NOT NULL, -- subscription_created, delivery_failed, schema_published
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    body TEXT,

    -- Related Entities
    subscriber_id UUID REFERENCES subscribers(id),
    schema_id UUID REFERENCES schemas(id),
    event_id VARCHAR(255),
    delivery_id VARCHAR(255),

    -- Delivery Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_logs_subscriber_id ON notification_logs(subscriber_id);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at DESC);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Update producers.updated_at
CREATE TRIGGER update_producers_updated_at
    BEFORE UPDATE ON producers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update schemas.updated_at
CREATE TRIGGER update_schemas_updated_at
    BEFORE UPDATE ON schemas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update subscribers.updated_at
CREATE TRIGGER update_subscribers_updated_at
    BEFORE UPDATE ON subscribers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update subscriptions.updated_at
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update subscription statistics on delivery completion
CREATE OR REPLACE FUNCTION update_subscription_statistics()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'success' AND OLD.status != 'success' THEN
        UPDATE subscriptions
        SET
            total_deliveries = total_deliveries + 1,
            successful_deliveries = successful_deliveries + 1,
            last_delivery_at = NEW.delivered_at,
            last_success_at = NEW.delivered_at,
            consecutive_failures = 0,
            avg_latency_ms = CASE
                WHEN total_deliveries = 0 THEN NEW.latency_ms
                ELSE ((avg_latency_ms * total_deliveries) + NEW.latency_ms) / (total_deliveries + 1)
            END
        WHERE id = NEW.subscription_id;
    ELSIF NEW.status = 'failed' AND OLD.status != 'failed' THEN
        UPDATE subscriptions
        SET
            total_deliveries = total_deliveries + 1,
            failed_deliveries = failed_deliveries + 1,
            last_delivery_at = NEW.delivered_at,
            last_failure_at = NEW.delivered_at,
            consecutive_failures = consecutive_failures + 1
        WHERE id = NEW.subscription_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_stats_on_delivery
    AFTER UPDATE OF status ON delivery_logs
    FOR EACH ROW
    WHEN (NEW.status IN ('success', 'failed') AND OLD.status != NEW.status)
    EXECUTE FUNCTION update_subscription_statistics();

-- Increment schema subscription count
CREATE OR REPLACE FUNCTION update_schema_subscription_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE schemas
        SET subscription_count = subscription_count + 1
        WHERE id = NEW.schema_id;

        UPDATE subscribers
        SET total_subscriptions = total_subscriptions + 1
        WHERE id = NEW.subscriber_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE schemas
        SET subscription_count = subscription_count - 1
        WHERE id = OLD.schema_id;

        UPDATE subscribers
        SET total_subscriptions = total_subscriptions - 1
        WHERE id = OLD.subscriber_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_schema_sub_count_on_subscription
    AFTER INSERT OR DELETE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_schema_subscription_count();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for subscription health
CREATE OR REPLACE VIEW subscription_health AS
SELECT
    s.id,
    s.subscriber_id,
    sub.name AS subscriber_name,
    s.schema_id,
    sch.event_type,
    s.webhook_url,
    s.enabled,
    s.status,
    s.total_deliveries,
    s.successful_deliveries,
    s.failed_deliveries,
    CASE
        WHEN s.total_deliveries = 0 THEN 0
        ELSE ROUND((s.successful_deliveries::DECIMAL / s.total_deliveries::DECIMAL) * 100, 2)
    END AS success_rate,
    s.avg_latency_ms,
    s.consecutive_failures,
    s.last_delivery_at,
    s.last_success_at,
    s.last_failure_at,
    CASE
        WHEN s.consecutive_failures >= 5 THEN 'critical'
        WHEN s.consecutive_failures >= 3 THEN 'warning'
        ELSE 'healthy'
    END AS health_status
FROM subscriptions s
JOIN subscribers sub ON sub.id = s.subscriber_id
JOIN schemas sch ON sch.id = s.schema_id
WHERE s.cancelled_at IS NULL;

-- View for producer analytics
CREATE OR REPLACE VIEW producer_analytics AS
SELECT
    p.id,
    p.name,
    p.status,
    p.total_events_published,
    p.total_schemas_registered,
    COUNT(DISTINCT s.id) AS active_schemas,
    SUM(s.subscription_count) AS total_subscriptions,
    p.last_published_at
FROM producers p
LEFT JOIN schemas s ON s.producer_id = p.id AND s.status = 'active'
GROUP BY p.id;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert system producer for internal events
INSERT INTO producers (id, name, description, api_key, api_key_hash, contact_email, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'System',
    'Internal system producer',
    'system_internal_key',
    encode(sha256('system_internal_key'::bytea), 'hex'),
    'system@internal.com',
    'active'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE producers IS 'Event producers (internal systems publishing events)';
COMMENT ON TABLE schemas IS 'Event schemas registered in Schema Registry';
COMMENT ON TABLE subscribers IS 'Partners/external systems subscribing to events';
COMMENT ON TABLE subscriptions IS 'Schema subscriptions linking subscribers to schemas';
COMMENT ON TABLE event_messages IS 'Published event messages';
COMMENT ON TABLE delivery_logs IS 'Delivery attempt logs for webhook deliveries';
COMMENT ON TABLE delivery_dlq IS 'Dead letter queue for permanently failed deliveries';
COMMENT ON TABLE notification_logs IS 'Email/SNS notification logs';

-- ============================================================================
-- END OF ENHANCED SCHEMA
-- ============================================================================