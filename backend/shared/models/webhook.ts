import { query, transaction } from '../utils/database';
import { PoolClient } from 'pg';

/**
 * Webhook interface
 */
export interface Webhook {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  url: string;
  event_type: string;
  schema_id?: string;
  enabled: boolean;
  status: 'active' | 'paused' | 'failed' | 'disabled';
  auth_type?: string;
  auth_config?: any;
  max_retries: number;
  backoff_strategy: 'exponential' | 'linear' | 'constant';
  initial_delay_ms: number;
  timeout_ms: number;
  custom_headers?: any;
  tags?: string[];
  secret: string;
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  avg_latency_ms: number;
  last_triggered_at?: Date;
  last_success_at?: Date;
  last_failure_at?: Date;
  consecutive_failures: number;
  circuit_breaker_open_until?: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

/**
 * Create webhook data transfer object
 */
export interface CreateWebhookDTO {
  user_id: string;
  name: string;
  description?: string;
  url: string;
  event_type: string;
  schema_id?: string;
  enabled?: boolean;
  auth_type?: string;
  auth_config?: any;
  max_retries?: number;
  backoff_strategy?: 'exponential' | 'linear' | 'constant';
  initial_delay_ms?: number;
  timeout_ms?: number;
  custom_headers?: any;
  tags?: string[];
  secret: string;
}

/**
 * Update webhook data transfer object
 */
export interface UpdateWebhookDTO {
  name?: string;
  description?: string;
  url?: string;
  enabled?: boolean;
  auth_type?: string;
  auth_config?: any;
  max_retries?: number;
  backoff_strategy?: 'exponential' | 'linear' | 'constant';
  initial_delay_ms?: number;
  timeout_ms?: number;
  custom_headers?: any;
  tags?: string[];
}

/**
 * Webhook filters
 */
export interface WebhookFilters {
  user_id?: string;
  status?: string;
  enabled?: boolean;
  event_type?: string;
  tags?: string[];
  search?: string;
}

/**
 * Create a new webhook
 */
export async function createWebhook(data: CreateWebhookDTO): Promise<Webhook> {
  const result = await query<Webhook>(
    `INSERT INTO webhooks (
      user_id, name, description, url, event_type, schema_id, enabled,
      auth_type, auth_config, max_retries, backoff_strategy, initial_delay_ms,
      timeout_ms, custom_headers, tags, secret
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`,
    [
      data.user_id,
      data.name,
      data.description || null,
      data.url,
      data.event_type,
      data.schema_id || null,
      data.enabled !== false,
      data.auth_type || 'none',
      data.auth_config ? JSON.stringify(data.auth_config) : null,
      data.max_retries ?? 3,
      data.backoff_strategy || 'exponential',
      data.initial_delay_ms ?? 1000,
      data.timeout_ms ?? 30000,
      data.custom_headers ? JSON.stringify(data.custom_headers) : null,
      data.tags || [],
      data.secret,
    ]
  );

  return result.rows[0];
}

/**
 * Get webhook by ID
 */
export async function getWebhookById(id: string, userId: string): Promise<Webhook | null> {
  const result = await query<Webhook>(
    'SELECT * FROM webhooks WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
    [id, userId]
  );

  return result.rows[0] || null;
}

/**
 * List webhooks with filters and pagination
 */
export async function listWebhooks(
  filters: WebhookFilters,
  page: number = 1,
  limit: number = 20,
  sortBy: string = 'created_at',
  sortOrder: 'asc' | 'desc' = 'desc'
): Promise<{ webhooks: Webhook[]; total: number }> {
  const offset = (page - 1) * limit;
  const conditions: string[] = ['deleted_at IS NULL'];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.user_id) {
    conditions.push(`user_id = $${paramIndex}`);
    params.push(filters.user_id);
    paramIndex++;
  }

  if (filters.status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.enabled !== undefined) {
    conditions.push(`enabled = $${paramIndex}`);
    params.push(filters.enabled);
    paramIndex++;
  }

  if (filters.event_type) {
    conditions.push(`event_type = $${paramIndex}`);
    params.push(filters.event_type);
    paramIndex++;
  }

  if (filters.tags && filters.tags.length > 0) {
    conditions.push(`tags && $${paramIndex}`);
    params.push(filters.tags);
    paramIndex++;
  }

  if (filters.search) {
    conditions.push(`(name ILIKE $${paramIndex} OR url ILIKE $${paramIndex})`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');
  const allowedSortFields = ['name', 'created_at', 'updated_at', 'last_triggered_at'];
  const sanitizedSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
  const sanitizedSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM webhooks WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated results
  const webhooksResult = await query<Webhook>(
    `SELECT * FROM webhooks
     WHERE ${whereClause}
     ORDER BY ${sanitizedSortBy} ${sanitizedSortOrder}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    webhooks: webhooksResult.rows,
    total,
  };
}

/**
 * Update webhook
 */
export async function updateWebhook(
  id: string,
  userId: string,
  data: UpdateWebhookDTO
): Promise<Webhook | null> {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex}`);
    params.push(data.name);
    paramIndex++;
  }

  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex}`);
    params.push(data.description);
    paramIndex++;
  }

  if (data.url !== undefined) {
    updates.push(`url = $${paramIndex}`);
    params.push(data.url);
    paramIndex++;
  }

  if (data.enabled !== undefined) {
    updates.push(`enabled = $${paramIndex}`);
    params.push(data.enabled);
    paramIndex++;
  }

  if (data.auth_type !== undefined) {
    updates.push(`auth_type = $${paramIndex}`);
    params.push(data.auth_type);
    paramIndex++;
  }

  if (data.auth_config !== undefined) {
    updates.push(`auth_config = $${paramIndex}`);
    params.push(JSON.stringify(data.auth_config));
    paramIndex++;
  }

  if (data.max_retries !== undefined) {
    updates.push(`max_retries = $${paramIndex}`);
    params.push(data.max_retries);
    paramIndex++;
  }

  if (data.backoff_strategy !== undefined) {
    updates.push(`backoff_strategy = $${paramIndex}`);
    params.push(data.backoff_strategy);
    paramIndex++;
  }

  if (data.initial_delay_ms !== undefined) {
    updates.push(`initial_delay_ms = $${paramIndex}`);
    params.push(data.initial_delay_ms);
    paramIndex++;
  }

  if (data.timeout_ms !== undefined) {
    updates.push(`timeout_ms = $${paramIndex}`);
    params.push(data.timeout_ms);
    paramIndex++;
  }

  if (data.custom_headers !== undefined) {
    updates.push(`custom_headers = $${paramIndex}`);
    params.push(JSON.stringify(data.custom_headers));
    paramIndex++;
  }

  if (data.tags !== undefined) {
    updates.push(`tags = $${paramIndex}`);
    params.push(data.tags);
    paramIndex++;
  }

  if (updates.length === 0) {
    return null;
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);

  const result = await query<Webhook>(
    `UPDATE webhooks
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} AND deleted_at IS NULL
     RETURNING *`,
    [...params, id, userId]
  );

  return result.rows[0] || null;
}

/**
 * Delete webhook (soft delete)
 */
export async function deleteWebhook(id: string, userId: string): Promise<boolean> {
  const result = await query(
    'UPDATE webhooks SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
    [id, userId]
  );

  return result.rowCount > 0;
}

/**
 * Regenerate webhook secret
 */
export async function regenerateWebhookSecret(
  id: string,
  userId: string,
  newSecret: string
): Promise<Webhook | null> {
  const result = await query<Webhook>(
    `UPDATE webhooks
     SET secret = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [newSecret, id, userId]
  );

  return result.rows[0] || null;
}

/**
 * Toggle webhook enabled status
 */
export async function toggleWebhookStatus(
  id: string,
  userId: string,
  enabled: boolean
): Promise<Webhook | null> {
  const result = await query<Webhook>(
    `UPDATE webhooks
     SET enabled = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [enabled, id, userId]
  );

  return result.rows[0] || null;
}

/**
 * Bulk update webhooks
 */
export async function bulkUpdateWebhooks(
  ids: string[],
  userId: string,
  updates: Partial<UpdateWebhookDTO>
): Promise<number> {
  return await transaction(async (client: PoolClient) => {
    let updatedCount = 0;

    for (const id of ids) {
      const result = await client.query(
        `UPDATE webhooks
         SET enabled = COALESCE($1, enabled),
             status = COALESCE($2, status),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND user_id = $4 AND deleted_at IS NULL`,
        [updates.enabled, (updates as any).status, id, userId]
      );

      updatedCount += result.rowCount;
    }

    return updatedCount;
  });
}