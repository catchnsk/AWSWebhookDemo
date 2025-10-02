-- Migration: 006_add_schema_fields_to_schemas_table
-- Add new fields to schemas table (duplicate of webhook_schemas changes)
-- Created: 2025-10-02

-- Check if columns already exist before adding
DO $$
BEGIN
    -- Add schema_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schemas' AND column_name='schema_id') THEN
        ALTER TABLE schemas ADD COLUMN schema_id VARCHAR(100) UNIQUE;
    END IF;

    -- Add domain column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schemas' AND column_name='domain') THEN
        ALTER TABLE schemas ADD COLUMN domain VARCHAR(50) CHECK (domain IN ('payment', 'account', 'apply'));
    END IF;

    -- Add partner_user_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schemas' AND column_name='partner_user_id') THEN
        ALTER TABLE schemas ADD COLUMN partner_user_id VARCHAR(255);
    END IF;

    -- Add system_user_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schemas' AND column_name='system_user_id') THEN
        ALTER TABLE schemas ADD COLUMN system_user_id VARCHAR(255);
    END IF;
END $$;

-- Update existing records with sequential schema_id
DO $$
DECLARE
    rec RECORD;
    counter INTEGER := 1;
BEGIN
    FOR rec IN
        SELECT id FROM schemas
        WHERE schema_id IS NULL
        ORDER BY created_at
    LOOP
        UPDATE schemas
        SET schema_id = 'SCHEMA-' || LPAD(counter::TEXT, 6, '0')
        WHERE id = rec.id;
        counter := counter + 1;
    END LOOP;
END $$;

-- Update existing records with random UUID for partner_user_id if null
UPDATE schemas
SET partner_user_id = 'PARTNER-' || substring(gen_random_uuid()::text from 1 for 8)
WHERE partner_user_id IS NULL OR partner_user_id = '';

-- Create indexes for new columns if they don't exist
CREATE INDEX IF NOT EXISTS idx_schemas_schema_id ON schemas(schema_id);
CREATE INDEX IF NOT EXISTS idx_schemas_domain ON schemas(domain);
CREATE INDEX IF NOT EXISTS idx_schemas_partner_user_id ON schemas(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_schemas_system_user_id ON schemas(system_user_id);

-- Create sequence for schemas table if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS schemas_id_seq START WITH 1;

-- Set the sequence to start from the next available number
SELECT setval('schemas_id_seq',
    COALESCE((SELECT COUNT(*) FROM schemas), 0) + 1,
    false
);

-- Create function to auto-generate schema fields for schemas table
CREATE OR REPLACE FUNCTION auto_generate_schemas_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-generate schema_id if not provided
    IF NEW.schema_id IS NULL OR NEW.schema_id = '' THEN
        NEW.schema_id := 'SCHEMA-' || LPAD(nextval('schemas_id_seq')::TEXT, 6, '0');
    END IF;

    -- Auto-generate partner_user_id if not provided
    IF NEW.partner_user_id IS NULL OR NEW.partner_user_id = '' THEN
        NEW.partner_user_id := 'PARTNER-' || substring(gen_random_uuid()::text from 1 for 8);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate fields on insert
DROP TRIGGER IF EXISTS auto_generate_schemas_fields_trigger ON schemas;
CREATE TRIGGER auto_generate_schemas_fields_trigger
    BEFORE INSERT ON schemas
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_schemas_fields();

-- Add comments
COMMENT ON SEQUENCE schemas_id_seq IS 'Sequence for auto-generating schema_id in schemas table';
COMMENT ON FUNCTION auto_generate_schemas_fields() IS 'Auto-generates schema_id and partner_user_id for new schemas';
