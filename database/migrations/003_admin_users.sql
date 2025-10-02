-- Admin Users Table
-- PostgreSQL 15+
-- Migration: 003_admin_users
-- Created: 2025-10-01

-- ============================================================================
-- ADMINS TABLE (Admin Users for System Management)
-- ============================================================================
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,

    -- Authentication
    api_key VARCHAR(255) UNIQUE NOT NULL,
    api_key_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA256 hash for lookup

    -- Authorization
    role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'viewer')),

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_admins_api_key_hash ON admins(api_key_hash);
CREATE INDEX idx_admins_email ON admins(email);
CREATE INDEX idx_admins_status ON admins(status);
CREATE INDEX idx_admins_role ON admins(role);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_admins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_admins_updated_at
    BEFORE UPDATE ON admins
    FOR EACH ROW
    EXECUTE FUNCTION update_admins_updated_at();
