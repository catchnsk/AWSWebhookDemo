-- Migration: 004_add_schema_fields
-- Add new fields to webhook_schemas table: schema_id, domain, partner_user_id, system_user_id
-- Created: 2025-10-02

-- Add new columns to webhook_schemas table
ALTER TABLE webhook_schemas
ADD COLUMN schema_id VARCHAR(100) UNIQUE,
ADD COLUMN domain VARCHAR(50) CHECK (domain IN ('payment', 'account', 'apply')),
ADD COLUMN partner_user_id VARCHAR(255),
ADD COLUMN system_user_id VARCHAR(255);

-- Add indexes for new columns
CREATE INDEX idx_webhook_schemas_schema_id ON webhook_schemas(schema_id);
CREATE INDEX idx_webhook_schemas_domain ON webhook_schemas(domain);
CREATE INDEX idx_webhook_schemas_partner_user_id ON webhook_schemas(partner_user_id);
CREATE INDEX idx_webhook_schemas_system_user_id ON webhook_schemas(system_user_id);

-- Add comments
COMMENT ON COLUMN webhook_schemas.schema_id IS 'Unique identifier for the schema (e.g., payment.order.created)';
COMMENT ON COLUMN webhook_schemas.domain IS 'Domain category: payment, account, or apply';
COMMENT ON COLUMN webhook_schemas.partner_user_id IS 'Partner user identifier associated with this schema';
COMMENT ON COLUMN webhook_schemas.system_user_id IS 'System user identifier associated with this schema';
