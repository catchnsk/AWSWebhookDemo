import { query } from '../utils/database';
import { generateApiKey, hashApiKey, generateWebhookSecret } from '../utils/crypto';

/**
 * Subscriber interface
 */
export interface Subscriber {
  id: string;
  name: string;
  company?: string;
  email: string;
  api_key: string;
  api_key_hash: string;
  webhook_url: string;
  webhook_secret: string;
  contact_name?: string;
  contact_phone?: string;
  auth_type: 'none' | 'hmac' | 'mtls' | 'oauth2';
  ip_whitelist?: string[];
  total_subscriptions: number;
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  status: 'active' | 'inactive' | 'suspended';
  created_at: Date;
  updated_at: Date;
  last_delivery_at?: Date;
}

/**
 * Create subscriber DTO
 */
export interface CreateSubscriberDTO {
  name: string;
  company?: string;
  email: string;
  webhook_url: string;
  contact_name?: string;
  contact_phone?: string;
  auth_type?: 'none' | 'hmac' | 'mtls' | 'oauth2';
  ip_whitelist?: string[];
}

/**
 * Update subscriber DTO
 */
export interface UpdateSubscriberDTO {
  name?: string;
  company?: string;
  email?: string;
  webhook_url?: string;
  contact_name?: string;
  contact_phone?: string;
  auth_type?: 'none' | 'hmac' | 'mtls' | 'oauth2';
  ip_whitelist?: string[];
  status?: 'active' | 'inactive' | 'suspended';
}

/**
 * Create a new subscriber
 */
export async function createSubscriber(data: CreateSubscriberDTO): Promise<{
  subscriber: Subscriber;
  apiKey: string;
  webhookSecret: string;
}> {
  // Generate API key and webhook secret
  const apiKey = generateApiKey('wh_sub');
  const apiKeyHash = hashApiKey(apiKey);
  const webhookSecret = generateWebhookSecret();

  const result = await query<Subscriber>(
    `INSERT INTO subscribers (
      name, company, email, api_key, api_key_hash, webhook_url, webhook_secret,
      contact_name, contact_phone, auth_type, ip_whitelist
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      data.name,
      data.company || null,
      data.email,
      apiKey,
      apiKeyHash,
      data.webhook_url,
      webhookSecret,
      data.contact_name || null,
      data.contact_phone || null,
      data.auth_type || 'hmac',
      data.ip_whitelist || null,
    ]
  );

  return {
    subscriber: result.rows[0],
    apiKey, // Return plain API key only once
    webhookSecret, // Return plain webhook secret only once
  };
}

/**
 * Get subscriber by ID
 */
export async function getSubscriberById(id: string): Promise<Subscriber | null> {
  const result = await query<Subscriber>(
    'SELECT * FROM subscribers WHERE id = $1',
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Get subscriber by API key hash
 */
export async function getSubscriberByApiKey(apiKey: string): Promise<Subscriber | null> {
  const apiKeyHash = hashApiKey(apiKey);

  const result = await query<Subscriber>(
    'SELECT * FROM subscribers WHERE api_key_hash = $1 AND status = $2',
    [apiKeyHash, 'active']
  );

  return result.rows[0] || null;
}

/**
 * Get subscriber by email
 */
export async function getSubscriberByEmail(email: string): Promise<Subscriber | null> {
  const result = await query<Subscriber>(
    'SELECT * FROM subscribers WHERE email = $1',
    [email]
  );

  return result.rows[0] || null;
}

/**
 * List subscribers with pagination
 */
export async function listSubscribers(
  filters: {
    status?: string;
    search?: string;
  } = {},
  page: number = 1,
  limit: number = 20
): Promise<{ subscribers: Subscriber[]; total: number }> {
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.search) {
    conditions.push(`(name ILIKE $${paramIndex} OR company ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM subscribers ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated results
  const subscribersResult = await query<Subscriber>(
    `SELECT * FROM subscribers
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    subscribers: subscribersResult.rows,
    total,
  };
}

/**
 * Update subscriber
 */
export async function updateSubscriber(
  id: string,
  data: UpdateSubscriberDTO
): Promise<Subscriber | null> {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex}`);
    params.push(data.name);
    paramIndex++;
  }

  if (data.company !== undefined) {
    updates.push(`company = $${paramIndex}`);
    params.push(data.company);
    paramIndex++;
  }

  if (data.email !== undefined) {
    updates.push(`email = $${paramIndex}`);
    params.push(data.email);
    paramIndex++;
  }

  if (data.webhook_url !== undefined) {
    updates.push(`webhook_url = $${paramIndex}`);
    params.push(data.webhook_url);
    paramIndex++;
  }

  if (data.contact_name !== undefined) {
    updates.push(`contact_name = $${paramIndex}`);
    params.push(data.contact_name);
    paramIndex++;
  }

  if (data.contact_phone !== undefined) {
    updates.push(`contact_phone = $${paramIndex}`);
    params.push(data.contact_phone);
    paramIndex++;
  }

  if (data.auth_type !== undefined) {
    updates.push(`auth_type = $${paramIndex}`);
    params.push(data.auth_type);
    paramIndex++;
  }

  if (data.ip_whitelist !== undefined) {
    updates.push(`ip_whitelist = $${paramIndex}`);
    params.push(data.ip_whitelist);
    paramIndex++;
  }

  if (data.status !== undefined) {
    updates.push(`status = $${paramIndex}`);
    params.push(data.status);
    paramIndex++;
  }

  if (updates.length === 0) {
    return null;
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);

  const result = await query<Subscriber>(
    `UPDATE subscribers
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    [...params, id]
  );

  return result.rows[0] || null;
}

/**
 * Regenerate subscriber API key
 */
export async function regenerateSubscriberApiKey(id: string): Promise<{
  subscriber: Subscriber;
  apiKey: string;
}> {
  const apiKey = generateApiKey('wh_sub');
  const apiKeyHash = hashApiKey(apiKey);

  const result = await query<Subscriber>(
    `UPDATE subscribers
     SET api_key = $1, api_key_hash = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [apiKey, apiKeyHash, id]
  );

  if (!result.rows[0]) {
    throw new Error('Subscriber not found');
  }

  return {
    subscriber: result.rows[0],
    apiKey,
  };
}

/**
 * Regenerate subscriber webhook secret
 */
export async function regenerateSubscriberWebhookSecret(id: string): Promise<{
  subscriber: Subscriber;
  webhookSecret: string;
}> {
  const webhookSecret = generateWebhookSecret();

  const result = await query<Subscriber>(
    `UPDATE subscribers
     SET webhook_secret = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [webhookSecret, id]
  );

  if (!result.rows[0]) {
    throw new Error('Subscriber not found');
  }

  return {
    subscriber: result.rows[0],
    webhookSecret,
  };
}

/**
 * Update subscriber delivery statistics
 */
export async function updateSubscriberDeliveryStats(
  subscriberId: string,
  success: boolean
): Promise<void> {
  if (success) {
    await query(
      `UPDATE subscribers
       SET total_deliveries = total_deliveries + 1,
           successful_deliveries = successful_deliveries + 1,
           last_delivery_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [subscriberId]
    );
  } else {
    await query(
      `UPDATE subscribers
       SET total_deliveries = total_deliveries + 1,
           failed_deliveries = failed_deliveries + 1,
           last_delivery_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [subscriberId]
    );
  }
}

/**
 * Delete subscriber (soft delete)
 */
export async function deleteSubscriber(id: string): Promise<boolean> {
  const result = await query(
    'UPDATE subscribers SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    ['inactive', id]
  );

  return result.rowCount > 0;
}