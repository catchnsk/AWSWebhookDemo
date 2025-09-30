import { query } from '../utils/database';

/**
 * Subscription interface
 */
export interface Subscription {
  id: string;
  subscriber_id: string;
  schema_id: string;
  webhook_url: string;
  webhook_secret: string;
  auth_type: string;
  auth_config?: any;
  custom_headers?: any;
  enabled: boolean;
  max_retries: number;
  backoff_strategy: 'exponential' | 'linear' | 'constant';
  initial_delay_ms: number;
  timeout_ms: number;
  payload_filter?: any;
  status: 'active' | 'paused' | 'suspended' | 'cancelled';
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  avg_latency_ms: number;
  consecutive_failures: number;
  last_delivery_at?: Date;
  last_success_at?: Date;
  last_failure_at?: Date;
  circuit_breaker_open_until?: Date;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: Date;
  created_at: Date;
  updated_at: Date;
  cancelled_at?: Date;
}

/**
 * Create subscription DTO
 */
export interface CreateSubscriptionDTO {
  subscriber_id: string;
  schema_id: string;
  webhook_url: string;
  webhook_secret: string;
  auth_type?: string;
  auth_config?: any;
  custom_headers?: any;
  enabled?: boolean;
  max_retries?: number;
  backoff_strategy?: 'exponential' | 'linear' | 'constant';
  initial_delay_ms?: number;
  timeout_ms?: number;
  payload_filter?: any;
}

/**
 * Update subscription DTO
 */
export interface UpdateSubscriptionDTO {
  webhook_url?: string;
  auth_type?: string;
  auth_config?: any;
  custom_headers?: any;
  enabled?: boolean;
  max_retries?: number;
  backoff_strategy?: 'exponential' | 'linear' | 'constant';
  initial_delay_ms?: number;
  timeout_ms?: number;
  payload_filter?: any;
  status?: 'active' | 'paused' | 'suspended';
}

/**
 * Create a new subscription
 */
export async function createSubscription(data: CreateSubscriptionDTO): Promise<Subscription> {
  const result = await query<Subscription>(
    `INSERT INTO subscriptions (
      subscriber_id, schema_id, webhook_url, webhook_secret, auth_type, auth_config,
      custom_headers, enabled, max_retries, backoff_strategy, initial_delay_ms,
      timeout_ms, payload_filter
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      data.subscriber_id,
      data.schema_id,
      data.webhook_url,
      data.webhook_secret,
      data.auth_type || 'hmac',
      data.auth_config ? JSON.stringify(data.auth_config) : null,
      data.custom_headers ? JSON.stringify(data.custom_headers) : null,
      data.enabled !== false,
      data.max_retries ?? 3,
      data.backoff_strategy || 'exponential',
      data.initial_delay_ms ?? 1000,
      data.timeout_ms ?? 30000,
      data.payload_filter ? JSON.stringify(data.payload_filter) : null,
    ]
  );

  return result.rows[0];
}

/**
 * Get subscription by ID
 */
export async function getSubscriptionById(id: string): Promise<Subscription | null> {
  const result = await query<Subscription>(
    'SELECT * FROM subscriptions WHERE id = $1 AND cancelled_at IS NULL',
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Get subscription by subscriber and schema
 */
export async function getSubscriptionBySubscriberAndSchema(
  subscriberId: string,
  schemaId: string
): Promise<Subscription | null> {
  const result = await query<Subscription>(
    'SELECT * FROM subscriptions WHERE subscriber_id = $1 AND schema_id = $2 AND cancelled_at IS NULL',
    [subscriberId, schemaId]
  );

  return result.rows[0] || null;
}

/**
 * List subscriptions for a subscriber
 */
export async function listSubscriptionsForSubscriber(
  subscriberId: string,
  filters: {
    status?: string;
    enabled?: boolean;
  } = {},
  page: number = 1,
  limit: number = 20
): Promise<{ subscriptions: Subscription[]; total: number }> {
  const offset = (page - 1) * limit;
  const conditions: string[] = ['subscriber_id = $1', 'cancelled_at IS NULL'];
  const params: any[] = [subscriberId];
  let paramIndex = 2;

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

  const whereClause = conditions.join(' AND ');

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM subscriptions WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated results
  const subscriptionsResult = await query<Subscription>(
    `SELECT * FROM subscriptions
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    subscriptions: subscriptionsResult.rows,
    total,
  };
}

/**
 * List active subscriptions for a schema (for event delivery)
 */
export async function listActiveSubscriptionsForSchema(schemaId: string): Promise<Subscription[]> {
  const result = await query<Subscription>(
    `SELECT * FROM subscriptions
     WHERE schema_id = $1
       AND enabled = true
       AND status = 'active'
       AND cancelled_at IS NULL
       AND (circuit_breaker_open_until IS NULL OR circuit_breaker_open_until < CURRENT_TIMESTAMP)`,
    [schemaId]
  );

  return result.rows;
}

/**
 * Get subscription with schema and subscriber details
 */
export async function getSubscriptionWithDetails(subscriptionId: string): Promise<{
  subscription: Subscription;
  schema: { id: string; name: string; event_type: string; version: string };
  subscriber: { id: string; name: string; email: string };
} | null> {
  const result = await query(
    `SELECT
      s.*,
      sch.id as schema_id,
      sch.name as schema_name,
      sch.event_type as schema_event_type,
      sch.version as schema_version,
      sub.id as subscriber_id,
      sub.name as subscriber_name,
      sub.email as subscriber_email
     FROM subscriptions s
     JOIN schemas sch ON sch.id = s.schema_id
     JOIN subscribers sub ON sub.id = s.subscriber_id
     WHERE s.id = $1 AND s.cancelled_at IS NULL`,
    [subscriptionId]
  );

  if (!result.rows[0]) {
    return null;
  }

  const row = result.rows[0];

  return {
    subscription: {
      id: row.id,
      subscriber_id: row.subscriber_id,
      schema_id: row.schema_id,
      webhook_url: row.webhook_url,
      webhook_secret: row.webhook_secret,
      auth_type: row.auth_type,
      auth_config: row.auth_config,
      custom_headers: row.custom_headers,
      enabled: row.enabled,
      max_retries: row.max_retries,
      backoff_strategy: row.backoff_strategy,
      initial_delay_ms: row.initial_delay_ms,
      timeout_ms: row.timeout_ms,
      payload_filter: row.payload_filter,
      status: row.status,
      total_deliveries: row.total_deliveries,
      successful_deliveries: row.successful_deliveries,
      failed_deliveries: row.failed_deliveries,
      avg_latency_ms: row.avg_latency_ms,
      consecutive_failures: row.consecutive_failures,
      last_delivery_at: row.last_delivery_at,
      last_success_at: row.last_success_at,
      last_failure_at: row.last_failure_at,
      circuit_breaker_open_until: row.circuit_breaker_open_until,
      approval_status: row.approval_status,
      approved_by: row.approved_by,
      approved_at: row.approved_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      cancelled_at: row.cancelled_at,
    },
    schema: {
      id: row.schema_id,
      name: row.schema_name,
      event_type: row.schema_event_type,
      version: row.schema_version,
    },
    subscriber: {
      id: row.subscriber_id,
      name: row.subscriber_name,
      email: row.subscriber_email,
    },
  };
}

/**
 * Update subscription
 */
export async function updateSubscription(
  id: string,
  data: UpdateSubscriptionDTO
): Promise<Subscription | null> {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.webhook_url !== undefined) {
    updates.push(`webhook_url = $${paramIndex}`);
    params.push(data.webhook_url);
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

  if (data.custom_headers !== undefined) {
    updates.push(`custom_headers = $${paramIndex}`);
    params.push(JSON.stringify(data.custom_headers));
    paramIndex++;
  }

  if (data.enabled !== undefined) {
    updates.push(`enabled = $${paramIndex}`);
    params.push(data.enabled);
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

  if (data.payload_filter !== undefined) {
    updates.push(`payload_filter = $${paramIndex}`);
    params.push(JSON.stringify(data.payload_filter));
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

  const result = await query<Subscription>(
    `UPDATE subscriptions
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex} AND cancelled_at IS NULL
     RETURNING *`,
    [...params, id]
  );

  return result.rows[0] || null;
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(id: string): Promise<boolean> {
  const result = await query(
    `UPDATE subscriptions
     SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND cancelled_at IS NULL`,
    [id]
  );

  return result.rowCount > 0;
}

/**
 * Approve subscription
 */
export async function approveSubscription(
  id: string,
  approvedBy: string
): Promise<Subscription | null> {
  const result = await query<Subscription>(
    `UPDATE subscriptions
     SET approval_status = 'approved',
         approved_by = $1,
         approved_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [approvedBy, id]
  );

  return result.rows[0] || null;
}

/**
 * Reject subscription
 */
export async function rejectSubscription(
  id: string,
  reviewedBy: string
): Promise<Subscription | null> {
  const result = await query<Subscription>(
    `UPDATE subscriptions
     SET approval_status = 'rejected',
         approved_by = $1,
         approved_at = CURRENT_TIMESTAMP,
         status = 'suspended',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [reviewedBy, id]
  );

  return result.rows[0] || null;
}

/**
 * Open circuit breaker (pause deliveries temporarily)
 */
export async function openCircuitBreaker(
  subscriptionId: string,
  durationMinutes: number = 30
): Promise<void> {
  await query(
    `UPDATE subscriptions
     SET circuit_breaker_open_until = CURRENT_TIMESTAMP + INTERVAL '${durationMinutes} minutes'
     WHERE id = $1`,
    [subscriptionId]
  );
}