-- Webhook Management System - Database Schema
-- PostgreSQL 15+
-- Migration: 001_initial_schema
-- Created: 2025-09-30

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cognito_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'developer', 'viewer')),
    api_key VARCHAR(255) UNIQUE,
    api_key_created_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for users table
CREATE INDEX idx_users_cognito_user_id ON users(cognito_user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_api_key ON users(api_key);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- WEBHOOK_SCHEMAS TABLE
-- ============================================================================
CREATE TABLE webhook_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) NOT NULL,
    schema JSONB NOT NULL, -- JSON Schema definition
    is_public BOOLEAN DEFAULT false,
    webhook_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT webhook_schemas_name_version_unique UNIQUE(name, version, user_id, deleted_at)
);

-- Indexes for webhook_schemas table
CREATE INDEX idx_webhook_schemas_user_id ON webhook_schemas(user_id);
CREATE INDEX idx_webhook_schemas_is_public ON webhook_schemas(is_public);
CREATE INDEX idx_webhook_schemas_name ON webhook_schemas(name);
CREATE INDEX idx_webhook_schemas_deleted_at ON webhook_schemas(deleted_at);

-- ============================================================================
-- WEBHOOKS TABLE
-- ============================================================================
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    url VARCHAR(2048) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    schema_id UUID REFERENCES webhook_schemas(id) ON DELETE SET NULL,
    enabled BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'failed', 'disabled')),

    -- Authentication
    auth_type VARCHAR(50) CHECK (auth_type IN ('bearer', 'api_key', 'oauth2', 'basic', 'none')),
    auth_config JSONB, -- Encrypted credentials

    -- Retry Configuration
    max_retries INTEGER DEFAULT 3 CHECK (max_retries >= 0 AND max_retries <= 10),
    backoff_strategy VARCHAR(50) DEFAULT 'exponential' CHECK (backoff_strategy IN ('exponential', 'linear', 'constant')),
    initial_delay_ms INTEGER DEFAULT 1000 CHECK (initial_delay_ms > 0),
    timeout_ms INTEGER DEFAULT 30000 CHECK (timeout_ms > 0),

    -- Custom Headers
    custom_headers JSONB,

    -- Metadata
    tags TEXT[],
    secret VARCHAR(255) NOT NULL, -- For webhook signature (HMAC)

    -- Statistics (denormalized for performance)
    total_deliveries BIGINT DEFAULT 0,
    successful_deliveries BIGINT DEFAULT 0,
    failed_deliveries BIGINT DEFAULT 0,
    avg_latency_ms INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,

    -- Circuit Breaker
    consecutive_failures INTEGER DEFAULT 0,
    circuit_breaker_open_until TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete

    CONSTRAINT webhooks_name_user_id_unique UNIQUE(name, user_id, deleted_at)
);

-- Indexes for webhooks table
CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX idx_webhooks_event_type ON webhooks(event_type);
CREATE INDEX idx_webhooks_status ON webhooks(status);
CREATE INDEX idx_webhooks_enabled ON webhooks(enabled);
CREATE INDEX idx_webhooks_tags ON webhooks USING gin(tags);
CREATE INDEX idx_webhooks_deleted_at ON webhooks(deleted_at);
CREATE INDEX idx_webhooks_schema_id ON webhooks(schema_id);
CREATE INDEX idx_webhooks_last_triggered_at ON webhooks(last_triggered_at);

-- ============================================================================
-- WEBHOOK_EXECUTIONS TABLE
-- ============================================================================
CREATE TABLE webhook_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    execution_id VARCHAR(255) UNIQUE NOT NULL,

    -- Request Details
    request_url VARCHAR(2048) NOT NULL,
    request_method VARCHAR(10) DEFAULT 'POST',
    request_headers JSONB,
    request_payload JSONB,

    -- Response Details
    response_status_code INTEGER,
    response_headers JSONB,
    response_body TEXT,

    -- Execution Metadata
    status VARCHAR(50) NOT NULL CHECK (status IN ('queued', 'processing', 'success', 'failed', 'retrying', 'timeout', 'cancelled')),
    retry_attempt INTEGER DEFAULT 0,
    latency_ms INTEGER,
    error_message TEXT,
    error_code VARCHAR(100),

    -- Timestamps
    queued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for webhook_executions table
CREATE INDEX idx_webhook_executions_webhook_id ON webhook_executions(webhook_id);
CREATE INDEX idx_webhook_executions_status ON webhook_executions(status);
CREATE INDEX idx_webhook_executions_created_at ON webhook_executions(created_at DESC);
CREATE INDEX idx_webhook_executions_execution_id ON webhook_executions(execution_id);
CREATE INDEX idx_webhook_executions_next_retry_at ON webhook_executions(next_retry_at) WHERE status = 'retrying';
CREATE INDEX idx_webhook_executions_webhook_status ON webhook_executions(webhook_id, status);

-- Partitioning by month for better performance (optional, for high volume)
-- This is commented out but can be enabled for production
-- CREATE TABLE webhook_executions_y2025m09 PARTITION OF webhook_executions
--     FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

-- ============================================================================
-- WEBHOOK_DEAD_LETTER_QUEUE TABLE
-- ============================================================================
CREATE TABLE webhook_dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    execution_id VARCHAR(255) NOT NULL,

    -- Original Request
    request_payload JSONB,
    request_url VARCHAR(2048),
    request_headers JSONB,

    -- Failure Details
    final_error_message TEXT,
    final_error_code VARCHAR(100),
    total_attempts INTEGER,
    first_attempt_at TIMESTAMP WITH TIME ZONE,
    last_attempt_at TIMESTAMP WITH TIME ZONE,

    -- Investigation Status
    investigated BOOLEAN DEFAULT false,
    resolution_notes TEXT,
    resolved_by VARCHAR(255), -- user_id who resolved it
    assigned_to VARCHAR(255), -- user_id assigned to investigate

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for webhook_dead_letter_queue table
CREATE INDEX idx_dlq_webhook_id ON webhook_dead_letter_queue(webhook_id);
CREATE INDEX idx_dlq_investigated ON webhook_dead_letter_queue(investigated);
CREATE INDEX idx_dlq_created_at ON webhook_dead_letter_queue(created_at DESC);
CREATE INDEX idx_dlq_assigned_to ON webhook_dead_letter_queue(assigned_to);
CREATE INDEX idx_dlq_execution_id ON webhook_dead_letter_queue(execution_id);

-- ============================================================================
-- WEBHOOK_EVENTS TABLE (Audit Log)
-- ============================================================================
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
    user_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL, -- webhook.created, webhook.updated, webhook.deleted, webhook.triggered, etc.
    event_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for webhook_events table
CREATE INDEX idx_webhook_events_webhook_id ON webhook_events(webhook_id);
CREATE INDEX idx_webhook_events_user_id ON webhook_events(user_id);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- ============================================================================
-- WEBHOOK_ANALYTICS TABLE (Aggregated Metrics)
-- ============================================================================
CREATE TABLE webhook_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    granularity VARCHAR(20) NOT NULL CHECK (granularity IN ('hourly', 'daily', 'weekly', 'monthly')),

    -- Metrics
    total_deliveries INTEGER DEFAULT 0,
    successful_deliveries INTEGER DEFAULT 0,
    failed_deliveries INTEGER DEFAULT 0,
    avg_latency_ms INTEGER DEFAULT 0,
    p50_latency_ms INTEGER DEFAULT 0,
    p95_latency_ms INTEGER DEFAULT 0,
    p99_latency_ms INTEGER DEFAULT 0,
    min_latency_ms INTEGER DEFAULT 0,
    max_latency_ms INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT webhook_analytics_unique UNIQUE(webhook_id, period_start, granularity)
);

-- Indexes for webhook_analytics table
CREATE INDEX idx_webhook_analytics_webhook_id ON webhook_analytics(webhook_id);
CREATE INDEX idx_webhook_analytics_period_start ON webhook_analytics(period_start DESC);
CREATE INDEX idx_webhook_analytics_granularity ON webhook_analytics(granularity);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for webhooks table
CREATE TRIGGER update_webhooks_updated_at
    BEFORE UPDATE ON webhooks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for webhook_schemas table
CREATE TRIGGER update_webhook_schemas_updated_at
    BEFORE UPDATE ON webhook_schemas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update webhook statistics
CREATE OR REPLACE FUNCTION update_webhook_statistics()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'success' THEN
        UPDATE webhooks
        SET
            total_deliveries = total_deliveries + 1,
            successful_deliveries = successful_deliveries + 1,
            last_triggered_at = NEW.completed_at,
            last_success_at = NEW.completed_at,
            consecutive_failures = 0,
            avg_latency_ms = CASE
                WHEN total_deliveries = 0 THEN NEW.latency_ms
                ELSE ((avg_latency_ms * total_deliveries) + NEW.latency_ms) / (total_deliveries + 1)
            END
        WHERE id = NEW.webhook_id;
    ELSIF NEW.status = 'failed' THEN
        UPDATE webhooks
        SET
            total_deliveries = total_deliveries + 1,
            failed_deliveries = failed_deliveries + 1,
            last_triggered_at = NEW.completed_at,
            last_failure_at = NEW.completed_at,
            consecutive_failures = consecutive_failures + 1
        WHERE id = NEW.webhook_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update webhook statistics when execution completes
CREATE TRIGGER update_webhook_stats_on_execution
    AFTER UPDATE OF status ON webhook_executions
    FOR EACH ROW
    WHEN (NEW.status IN ('success', 'failed') AND OLD.status != NEW.status)
    EXECUTE FUNCTION update_webhook_statistics();

-- Function to increment schema webhook count
CREATE OR REPLACE FUNCTION update_schema_webhook_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.schema_id IS NOT NULL THEN
        UPDATE webhook_schemas
        SET webhook_count = webhook_count + 1
        WHERE id = NEW.schema_id;
    ELSIF TG_OP = 'DELETE' AND OLD.schema_id IS NOT NULL THEN
        UPDATE webhook_schemas
        SET webhook_count = webhook_count - 1
        WHERE id = OLD.schema_id;
    ELSIF TG_OP = 'UPDATE' AND NEW.schema_id != OLD.schema_id THEN
        IF OLD.schema_id IS NOT NULL THEN
            UPDATE webhook_schemas
            SET webhook_count = webhook_count - 1
            WHERE id = OLD.schema_id;
        END IF;
        IF NEW.schema_id IS NOT NULL THEN
            UPDATE webhook_schemas
            SET webhook_count = webhook_count + 1
            WHERE id = NEW.schema_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update schema webhook count
CREATE TRIGGER update_schema_count_on_webhook_change
    AFTER INSERT OR UPDATE OF schema_id OR DELETE ON webhooks
    FOR EACH ROW
    EXECUTE FUNCTION update_schema_webhook_count();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for webhook statistics
CREATE OR REPLACE VIEW webhook_stats AS
SELECT
    w.id,
    w.name,
    w.url,
    w.event_type,
    w.status,
    w.enabled,
    w.total_deliveries,
    w.successful_deliveries,
    w.failed_deliveries,
    CASE
        WHEN w.total_deliveries = 0 THEN 0
        ELSE ROUND((w.successful_deliveries::DECIMAL / w.total_deliveries::DECIMAL) * 100, 2)
    END AS success_rate,
    w.avg_latency_ms,
    w.last_triggered_at,
    w.last_success_at,
    w.last_failure_at,
    w.consecutive_failures,
    w.created_at
FROM webhooks w
WHERE w.deleted_at IS NULL;

-- View for recent webhook executions
CREATE OR REPLACE VIEW recent_webhook_executions AS
SELECT
    we.id,
    we.execution_id,
    we.webhook_id,
    w.name AS webhook_name,
    w.url AS webhook_url,
    we.status,
    we.retry_attempt,
    we.latency_ms,
    we.response_status_code,
    we.error_message,
    we.created_at,
    we.completed_at
FROM webhook_executions we
JOIN webhooks w ON w.id = we.webhook_id
WHERE w.deleted_at IS NULL
ORDER BY we.created_at DESC
LIMIT 1000;

-- View for failed webhooks requiring attention
CREATE OR REPLACE VIEW failed_webhooks_alert AS
SELECT
    w.id,
    w.name,
    w.url,
    w.consecutive_failures,
    w.last_failure_at,
    w.status,
    COUNT(dlq.id) AS dlq_count
FROM webhooks w
LEFT JOIN webhook_dead_letter_queue dlq ON dlq.webhook_id = w.id AND dlq.investigated = false
WHERE w.deleted_at IS NULL
    AND (w.consecutive_failures >= 3 OR w.status = 'failed')
GROUP BY w.id, w.name, w.url, w.consecutive_failures, w.last_failure_at, w.status
ORDER BY w.consecutive_failures DESC, w.last_failure_at DESC;

-- ============================================================================
-- SEED DATA (Optional)
-- ============================================================================

-- Insert default schemas
INSERT INTO webhook_schemas (user_id, name, description, version, schema, is_public) VALUES
('system', 'Generic Event', 'Generic event schema with flexible payload', '1.0.0',
'{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["eventType", "timestamp"],
  "properties": {
    "eventType": { "type": "string" },
    "timestamp": { "type": "string", "format": "date-time" },
    "data": { "type": "object" }
  }
}'::jsonb, true),

('system', 'Order Event', 'Schema for order-related events', '1.0.0',
'{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["orderId", "customerId", "amount", "status"],
  "properties": {
    "orderId": { "type": "string" },
    "customerId": { "type": "string" },
    "amount": { "type": "number", "minimum": 0 },
    "status": { "type": "string", "enum": ["created", "pending", "completed", "cancelled"] },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "productId": { "type": "string" },
          "quantity": { "type": "integer", "minimum": 1 },
          "price": { "type": "number", "minimum": 0 }
        }
      }
    },
    "timestamp": { "type": "string", "format": "date-time" }
  }
}'::jsonb, true),

('system', 'User Event', 'Schema for user-related events', '1.0.0',
'{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["userId", "action"],
  "properties": {
    "userId": { "type": "string" },
    "action": { "type": "string", "enum": ["created", "updated", "deleted", "login", "logout"] },
    "email": { "type": "string", "format": "email" },
    "name": { "type": "string" },
    "timestamp": { "type": "string", "format": "date-time" }
  }
}'::jsonb, true);

-- ============================================================================
-- GRANTS (Adjust based on your user setup)
-- ============================================================================

-- Example: Grant permissions to application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO webhook_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO webhook_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO webhook_app_user;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE webhooks IS 'Stores webhook configurations and metadata';
COMMENT ON TABLE webhook_schemas IS 'Stores reusable JSON schemas for webhook payloads';
COMMENT ON TABLE webhook_executions IS 'Records of all webhook delivery attempts';
COMMENT ON TABLE webhook_dead_letter_queue IS 'Failed webhooks after exhausting all retries';
COMMENT ON TABLE webhook_events IS 'Audit log for webhook-related events';
COMMENT ON TABLE webhook_analytics IS 'Aggregated metrics for webhook performance';
COMMENT ON TABLE users IS 'User accounts for the webhook management system';

COMMENT ON COLUMN webhooks.secret IS 'HMAC secret for webhook signature verification';
COMMENT ON COLUMN webhooks.auth_config IS 'Encrypted authentication credentials (should be encrypted at application level)';
COMMENT ON COLUMN webhooks.consecutive_failures IS 'Counter for circuit breaker pattern';
COMMENT ON COLUMN webhooks.circuit_breaker_open_until IS 'Timestamp when circuit breaker will close and allow retries';

-- ============================================================================
-- INDEXES FOR COMMON QUERIES
-- ============================================================================

-- Index for filtering webhooks by multiple criteria
CREATE INDEX idx_webhooks_composite_filter ON webhooks(user_id, status, enabled, deleted_at);

-- Index for execution log queries with time range
CREATE INDEX idx_webhook_executions_webhook_time ON webhook_executions(webhook_id, created_at DESC);

-- Index for finding executions that need retry
CREATE INDEX idx_webhook_executions_retry ON webhook_executions(status, next_retry_at)
    WHERE status = 'retrying' AND next_retry_at IS NOT NULL;

-- ============================================================================
-- MAINTENANCE
-- ============================================================================

-- Function to clean up old execution logs (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_executions(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM webhook_executions
    WHERE created_at < CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL
    AND status IN ('success', 'failed');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_executions IS 'Deletes execution logs older than specified retention period';

-- Example usage: SELECT cleanup_old_executions(90);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================