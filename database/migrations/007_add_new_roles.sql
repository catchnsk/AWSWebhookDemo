-- Migration: Add new roles (tester and RTB)
-- This updates the role constraint to include the new roles

-- Drop the existing constraint
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_role_check;

-- Add new constraint with additional roles
ALTER TABLE admins ADD CONSTRAINT admins_role_check
  CHECK (role IN ('super_admin', 'admin', 'viewer', 'tester', 'rtb'));

-- Update any existing viewers if needed (optional, for reference)
-- UPDATE admins SET role = 'viewer' WHERE role = 'viewer';
