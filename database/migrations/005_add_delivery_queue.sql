-- Migration: Add delivery_queue table for webhook delivery processing
-- This table tracks pending webhook deliveries that need to be sent

CREATE TABLE IF NOT EXISTS delivery_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id VARCHAR(255) UNIQUE NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
    webhook_url VARCHAR(2048) NOT NULL,
    payload JSONB NOT NULL,
    max_retries INTEGER DEFAULT 3,
    backoff_strategy VARCHAR(50) DEFAULT 'exponential',
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT delivery_queue_status_check CHECK (
        status IN ('queued', 'processing', 'completed', 'failed', 'retrying')
    ),
    CONSTRAINT delivery_queue_backoff_check CHECK (
        backoff_strategy IN ('exponential', 'linear', 'fixed')
    )
);

-- Indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_delivery_queue_status ON delivery_queue(status);
CREATE INDEX IF NOT EXISTS idx_delivery_queue_next_retry ON delivery_queue(next_retry_at)
    WHERE status IN ('queued', 'retrying');
CREATE INDEX IF NOT EXISTS idx_delivery_queue_event_id ON delivery_queue(event_id);
CREATE INDEX IF NOT EXISTS idx_delivery_queue_subscription_id ON delivery_queue(subscription_id);
CREATE INDEX IF NOT EXISTS idx_delivery_queue_created_at ON delivery_queue(created_at DESC);

-- Add foreign key to event_messages
ALTER TABLE delivery_queue
    ADD CONSTRAINT delivery_queue_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES event_messages(event_id) ON DELETE CASCADE;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_delivery_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER delivery_queue_update_timestamp
    BEFORE UPDATE ON delivery_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_delivery_queue_timestamp();

COMMENT ON TABLE delivery_queue IS 'Queue of webhook deliveries pending processing';
COMMENT ON COLUMN delivery_queue.status IS 'Current status: queued, processing, completed, failed, retrying';
COMMENT ON COLUMN delivery_queue.backoff_strategy IS 'Retry backoff strategy: exponential, linear, fixed';
COMMENT ON COLUMN delivery_queue.next_retry_at IS 'Timestamp for next retry attempt (NULL if not retrying)';
