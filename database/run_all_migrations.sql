-- Run all migrations in order
-- Copy and paste this entire file into pgAdmin Query Tool

-- Migration 001: Initial Schema
\i 001_initial_schema.sql

-- Migration 002: Admin Users
\i 002_add_admin_users.sql

-- Migration 003: Security Questions
\i 003_add_security_questions.sql

-- Migration 004: Schema Fields
\i 004_add_schema_fields.sql

-- Migration 005: Events and Deliveries
\i 005_add_events_deliveries.sql

-- Migration 006: Subscribers
\i 006_add_subscribers.sql

-- Migration 007: Seed Data
\i 007_seed_data.sql

-- Migration 008: Subscriber ID to Admins
\i 008_add_subscriber_id_to_admins.sql
