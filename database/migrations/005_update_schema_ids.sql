-- Migration: 005_update_schema_ids
-- Auto-generate schema_id and partner_user_id for existing and new records
-- Created: 2025-10-02

-- First, update existing records with sequential schema_id
DO $$
DECLARE
    rec RECORD;
    counter INTEGER := 1;
BEGIN
    FOR rec IN
        SELECT id FROM webhook_schemas
        WHERE schema_id IS NULL
        ORDER BY created_at
    LOOP
        UPDATE webhook_schemas
        SET schema_id = 'SCHEMA-' || LPAD(counter::TEXT, 6, '0')
        WHERE id = rec.id;
        counter := counter + 1;
    END LOOP;
END $$;

-- Update existing records with random UUID for partner_user_id if null
UPDATE webhook_schemas
SET partner_user_id = 'PARTNER-' || substring(gen_random_uuid()::text from 1 for 8)
WHERE partner_user_id IS NULL OR partner_user_id = '';

-- Create a sequence for schema_id
CREATE SEQUENCE IF NOT EXISTS webhook_schemas_id_seq START WITH 1;

-- Set the sequence to start from the next available number
SELECT setval('webhook_schemas_id_seq',
    COALESCE((SELECT COUNT(*) FROM webhook_schemas), 0) + 1,
    false
);

-- Create function to auto-generate schema_id and partner_user_id
CREATE OR REPLACE FUNCTION auto_generate_schema_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-generate schema_id if not provided
    IF NEW.schema_id IS NULL OR NEW.schema_id = '' THEN
        NEW.schema_id := 'SCHEMA-' || LPAD(nextval('webhook_schemas_id_seq')::TEXT, 6, '0');
    END IF;

    -- Auto-generate partner_user_id if not provided
    IF NEW.partner_user_id IS NULL OR NEW.partner_user_id = '' THEN
        NEW.partner_user_id := 'PARTNER-' || substring(gen_random_uuid()::text from 1 for 8);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate fields on insert
DROP TRIGGER IF EXISTS auto_generate_schema_fields_trigger ON webhook_schemas;
CREATE TRIGGER auto_generate_schema_fields_trigger
    BEFORE INSERT ON webhook_schemas
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_schema_fields();

-- Add comments
COMMENT ON SEQUENCE webhook_schemas_id_seq IS 'Sequence for auto-generating schema_id';
COMMENT ON FUNCTION auto_generate_schema_fields() IS 'Auto-generates schema_id and partner_user_id for new webhook schemas';
