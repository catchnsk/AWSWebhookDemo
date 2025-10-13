-- Migration 008: Add subscriber_id to admins table for multi-tenancy
-- This links admin users to subscribers (companies) for data isolation

-- Add subscriber_id column to admins table
ALTER TABLE admins
ADD COLUMN IF NOT EXISTS subscriber_id UUID REFERENCES subscribers(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admins_subscriber_id ON admins(subscriber_id);

-- Add subscriber_id column to schemas table to link schemas to subscribers
ALTER TABLE schemas
ADD COLUMN IF NOT EXISTS subscriber_id UUID REFERENCES subscribers(id) ON DELETE CASCADE;

-- Create index for faster schema lookups by subscriber
CREATE INDEX IF NOT EXISTS idx_schemas_subscriber_id ON schemas(subscriber_id);

-- Comments for documentation
COMMENT ON COLUMN admins.subscriber_id IS 'Links admin user to a subscriber (company) for multi-tenancy data isolation';
COMMENT ON COLUMN schemas.subscriber_id IS 'Links schema to a subscriber (company) for multi-tenancy data isolation';
