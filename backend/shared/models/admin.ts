import { query } from '../utils/database';
import { generateApiKey, hashApiKey } from '../utils/crypto';
import * as bcrypt from 'bcryptjs';

/**
 * Admin interface
 */
export interface Admin {
  id: string;
  name: string;
  email: string;
  api_key: string;
  api_key_hash: string;
  password_hash?: string;
  role: 'super_admin' | 'admin' | 'viewer' | 'tester' | 'rtb';
  status: 'active' | 'inactive' | 'suspended';
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}

/**
 * Create admin DTO
 */
export interface CreateAdminDTO {
  name: string;
  email: string;
  password: string;
  role?: 'super_admin' | 'admin' | 'viewer' | 'tester' | 'rtb';
}

/**
 * Update admin DTO
 */
export interface UpdateAdminDTO {
  name?: string;
  email?: string;
  role?: 'super_admin' | 'admin' | 'viewer' | 'tester' | 'rtb';
  status?: 'active' | 'inactive' | 'suspended';
  password?: string;
}

/**
 * Create a new admin user
 */
export async function createAdmin(data: CreateAdminDTO): Promise<{
  admin: Admin;
  apiKey: string;
}> {
  // Generate API key
  const apiKey = generateApiKey('wh_admin');
  const apiKeyHash = hashApiKey(apiKey);

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, 10);

  const result = await query<Admin>(
    `INSERT INTO admins (
      name, email, api_key, api_key_hash, password_hash, role
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      data.name,
      data.email,
      apiKey,
      apiKeyHash,
      passwordHash,
      data.role || 'admin',
    ]
  );

  return {
    admin: result.rows[0],
    apiKey, // Return plain API key only once
  };
}

/**
 * Get admin by ID
 */
export async function getAdminById(id: string): Promise<Admin | null> {
  const result = await query<Admin>(
    'SELECT * FROM admins WHERE id = $1',
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Get admin by API key hash
 */
export async function getAdminByApiKey(apiKey: string): Promise<Admin | null> {
  const apiKeyHash = hashApiKey(apiKey);

  const result = await query<Admin>(
    'SELECT * FROM admins WHERE api_key_hash = $1 AND status = $2',
    [apiKeyHash, 'active']
  );

  return result.rows[0] || null;
}

/**
 * Get admin by email
 */
export async function getAdminByEmail(email: string): Promise<Admin | null> {
  const result = await query<Admin>(
    'SELECT * FROM admins WHERE email = $1',
    [email]
  );

  return result.rows[0] || null;
}

/**
 * List admins with pagination
 */
export async function listAdmins(
  filters: {
    status?: string;
    role?: string;
    search?: string;
  } = {},
  page: number = 1,
  limit: number = 20
): Promise<{ admins: Admin[]; total: number }> {
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.role) {
    conditions.push(`role = $${paramIndex}`);
    params.push(filters.role);
    paramIndex++;
  }

  if (filters.search) {
    conditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM admins ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated results
  const adminsResult = await query<Admin>(
    `SELECT * FROM admins
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    admins: adminsResult.rows,
    total,
  };
}

/**
 * Update admin
 */
export async function updateAdmin(
  id: string,
  data: UpdateAdminDTO
): Promise<Admin | null> {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex}`);
    params.push(data.name);
    paramIndex++;
  }

  if (data.email !== undefined) {
    updates.push(`email = $${paramIndex}`);
    params.push(data.email);
    paramIndex++;
  }

  if (data.role !== undefined) {
    updates.push(`role = $${paramIndex}`);
    params.push(data.role);
    paramIndex++;
  }

  if (data.status !== undefined) {
    updates.push(`status = $${paramIndex}`);
    params.push(data.status);
    paramIndex++;
  }

  if (data.password !== undefined) {
    console.log('Hashing new password for admin update');
    const passwordHash = await bcrypt.hash(data.password, 10);
    console.log('Password hashed, length:', passwordHash.length);
    updates.push(`password_hash = $${paramIndex}`);
    params.push(passwordHash);
    paramIndex++;
  }

  if (updates.length === 0) {
    return null;
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);

  const result = await query<Admin>(
    `UPDATE admins
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    [...params, id]
  );

  return result.rows[0] || null;
}

/**
 * Regenerate admin API key
 */
export async function regenerateAdminApiKey(id: string): Promise<{
  admin: Admin;
  apiKey: string;
}> {
  // Generate new API key
  const apiKey = generateApiKey('wh_admin');
  const apiKeyHash = hashApiKey(apiKey);

  const result = await query<Admin>(
    `UPDATE admins
     SET api_key = $1, api_key_hash = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [apiKey, apiKeyHash, id]
  );

  if (!result.rows[0]) {
    throw new Error('Admin not found');
  }

  return {
    admin: result.rows[0],
    apiKey,
  };
}

/**
 * Update last login time
 */
export async function updateAdminLastLogin(id: string): Promise<void> {
  await query(
    `UPDATE admins
     SET last_login_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id]
  );
}

/**
 * Delete admin (soft delete by setting status)
 */
export async function deleteAdmin(id: string): Promise<boolean> {
  const result = await query(
    'UPDATE admins SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    ['inactive', id]
  );

  return result.rowCount > 0;
}

/**
 * Verify admin password
 */
export async function verifyAdminPassword(email: string, password: string): Promise<Admin | null> {
  const admin = await getAdminByEmail(email);
  console.log('Verify password for:', email, 'Found admin:', !!admin, 'Has password hash:', !!admin?.password_hash);

  if (!admin || !admin.password_hash) {
    console.log('Admin not found or no password hash');
    return null;
  }

  const isValid = await bcrypt.compare(password, admin.password_hash);
  console.log('Password valid:', isValid, 'Status:', admin.status);

  if (!isValid || admin.status !== 'active') {
    console.log('Invalid password or inactive status');
    return null;
  }

  return admin;
}
