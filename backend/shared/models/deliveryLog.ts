import { query } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Delivery Log interface
 */
export interface DeliveryLog {
  id: string;
  delivery_id: string;
  event_id: string;
  subscription_id: string;
  subscriber_id: string;
  request_url: string;
  request_method: string;
  request_headers?: any;
  request_payload?: any;
  response_status_code?: number;
  response_headers?: any;
  response_body?: string;
  status: 'queued' | 'delivering' | 'success' | 'failed' | 'retrying' | 'timeout' | 'cancelled';
  retry_attempt: number;
  latency_ms?: number;
  error_message?: string;
  error_code?: string;
  error_category?: 'network' | 'timeout' | '4xx' | '5xx' | 'validation';
  queued_at: Date;
  delivered_at?: Date;
  next_retry_at?: Date;
  created_at: Date;
}

/**
 * Create delivery log DTO
 */
export interface CreateDeliveryLogDTO {
  event_id: string;
  subscription_id: string;
  subscriber_id: string;
  request_url: string;
  request_method?: string;
  request_headers?: any;
  request_payload?: any;
  status?: string;
  retry_attempt?: number;
}

/**
 * Update delivery log DTO
 */
export interface UpdateDeliveryLogDTO {
  status?: string;
  response_status_code?: number;
  response_headers?: any;
  response_body?: string;
  latency_ms?: number;
  error_message?: string;
  error_code?: string;
  error_category?: 'network' | 'timeout' | '4xx' | '5xx' | 'validation';
  delivered_at?: Date;
  next_retry_at?: Date;
}

/**
 * Create delivery log
 */
export async function createDeliveryLog(data: CreateDeliveryLogDTO): Promise<DeliveryLog> {
  const deliveryId = `dlv_${uuidv4().replace(/-/g, '')}`;

  const result = await query<DeliveryLog>(
    `INSERT INTO delivery_logs (
      delivery_id, event_id, subscription_id, subscriber_id, request_url,
      request_method, request_headers, request_payload, status, retry_attempt
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      deliveryId,
      data.event_id,
      data.subscription_id,
      data.subscriber_id,
      data.request_url,
      data.request_method || 'POST',
      data.request_headers ? JSON.stringify(data.request_headers) : null,
      data.request_payload ? JSON.stringify(data.request_payload) : null,
      data.status || 'queued',
      data.retry_attempt || 0,
    ]
  );

  return result.rows[0];
}

/**
 * Get delivery log by delivery ID
 */
export async function getDeliveryLogByDeliveryId(deliveryId: string): Promise<DeliveryLog | null> {
  const result = await query<DeliveryLog>(
    'SELECT * FROM delivery_logs WHERE delivery_id = $1',
    [deliveryId]
  );

  return result.rows[0] || null;
}

/**
 * Get delivery log by ID
 */
export async function getDeliveryLogById(id: string): Promise<DeliveryLog | null> {
  const result = await query<DeliveryLog>(
    'SELECT * FROM delivery_logs WHERE id = $1',
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Update delivery log
 */
export async function updateDeliveryLog(
  deliveryId: string,
  data: UpdateDeliveryLogDTO
): Promise<DeliveryLog | null> {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.status !== undefined) {
    updates.push(`status = $${paramIndex}`);
    params.push(data.status);
    paramIndex++;
  }

  if (data.response_status_code !== undefined) {
    updates.push(`response_status_code = $${paramIndex}`);
    params.push(data.response_status_code);
    paramIndex++;
  }

  if (data.response_headers !== undefined) {
    updates.push(`response_headers = $${paramIndex}`);
    params.push(JSON.stringify(data.response_headers));
    paramIndex++;
  }

  if (data.response_body !== undefined) {
    updates.push(`response_body = $${paramIndex}`);
    params.push(data.response_body);
    paramIndex++;
  }

  if (data.latency_ms !== undefined) {
    updates.push(`latency_ms = $${paramIndex}`);
    params.push(data.latency_ms);
    paramIndex++;
  }

  if (data.error_message !== undefined) {
    updates.push(`error_message = $${paramIndex}`);
    params.push(data.error_message);
    paramIndex++;
  }

  if (data.error_code !== undefined) {
    updates.push(`error_code = $${paramIndex}`);
    params.push(data.error_code);
    paramIndex++;
  }

  if (data.error_category !== undefined) {
    updates.push(`error_category = $${paramIndex}`);
    params.push(data.error_category);
    paramIndex++;
  }

  if (data.delivered_at !== undefined) {
    updates.push(`delivered_at = $${paramIndex}`);
    params.push(data.delivered_at);
    paramIndex++;
  }

  if (data.next_retry_at !== undefined) {
    updates.push(`next_retry_at = $${paramIndex}`);
    params.push(data.next_retry_at);
    paramIndex++;
  }

  if (updates.length === 0) {
    return null;
  }

  const result = await query<DeliveryLog>(
    `UPDATE delivery_logs
     SET ${updates.join(', ')}
     WHERE delivery_id = $${paramIndex}
     RETURNING *`,
    [...params, deliveryId]
  );

  return result.rows[0] || null;
}

/**
 * List delivery logs for a subscription
 */
export async function listDeliveryLogs(
  filters: {
    subscription_id?: string;
    event_id?: string;
    subscriber_id?: string;
    status?: string;
    from?: Date;
    to?: Date;
  } = {},
  page: number = 1,
  limit: number = 50
): Promise<{ logs: DeliveryLog[]; total: number }> {
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.subscription_id) {
    conditions.push(`subscription_id = $${paramIndex}`);
    params.push(filters.subscription_id);
    paramIndex++;
  }

  if (filters.event_id) {
    conditions.push(`event_id = $${paramIndex}`);
    params.push(filters.event_id);
    paramIndex++;
  }

  if (filters.subscriber_id) {
    conditions.push(`subscriber_id = $${paramIndex}`);
    params.push(filters.subscriber_id);
    paramIndex++;
  }

  if (filters.status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.from) {
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(filters.from);
    paramIndex++;
  }

  if (filters.to) {
    conditions.push(`created_at <= $${paramIndex}`);
    params.push(filters.to);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM delivery_logs ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated results
  const logsResult = await query<DeliveryLog>(
    `SELECT * FROM delivery_logs
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    logs: logsResult.rows,
    total,
  };
}

/**
 * Get deliveries ready for retry
 */
export async function getDeliveriesForRetry(limit: number = 100): Promise<DeliveryLog[]> {
  const result = await query<DeliveryLog>(
    `SELECT * FROM delivery_logs
     WHERE status = 'retrying'
       AND next_retry_at <= CURRENT_TIMESTAMP
     ORDER BY next_retry_at ASC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}

/**
 * Move delivery to dead letter queue
 */
export async function moveToDeadLetterQueue(deliveryLog: DeliveryLog): Promise<void> {
  await query(
    `INSERT INTO delivery_dlq (
      delivery_id, event_id, subscription_id, subscriber_id, request_url,
      request_payload, request_headers, final_error_message, final_error_code,
      final_error_category, total_attempts, first_attempt_at, last_attempt_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      deliveryLog.delivery_id,
      deliveryLog.event_id,
      deliveryLog.subscription_id,
      deliveryLog.subscriber_id,
      deliveryLog.request_url,
      deliveryLog.request_payload,
      deliveryLog.request_headers,
      deliveryLog.error_message,
      deliveryLog.error_code,
      deliveryLog.error_category,
      deliveryLog.retry_attempt + 1,
      deliveryLog.queued_at,
      new Date(),
    ]
  );

  // Update delivery log status to failed
  await updateDeliveryLog(deliveryLog.delivery_id, {
    status: 'failed',
  });
}

/**
 * Get delivery log with subscription and event details
 */
export async function getDeliveryLogWithDetails(deliveryId: string): Promise<{
  log: DeliveryLog;
  subscription: { id: string; webhook_url: string };
  subscriber: { id: string; name: string; email: string };
  event: { event_id: string; event_type: string };
} | null> {
  const result = await query(
    `SELECT
      dl.*,
      s.id as subscription_id,
      s.webhook_url as subscription_webhook_url,
      sub.id as subscriber_id,
      sub.name as subscriber_name,
      sub.email as subscriber_email,
      e.event_id as event_event_id,
      e.event_type as event_event_type
     FROM delivery_logs dl
     JOIN subscriptions s ON s.id = dl.subscription_id
     JOIN subscribers sub ON sub.id = dl.subscriber_id
     JOIN event_messages e ON e.event_id = dl.event_id
     WHERE dl.delivery_id = $1`,
    [deliveryId]
  );

  if (!result.rows[0]) {
    return null;
  }

  const row = result.rows[0];

  return {
    log: {
      id: row.id,
      delivery_id: row.delivery_id,
      event_id: row.event_id,
      subscription_id: row.subscription_id,
      subscriber_id: row.subscriber_id,
      request_url: row.request_url,
      request_method: row.request_method,
      request_headers: row.request_headers,
      request_payload: row.request_payload,
      response_status_code: row.response_status_code,
      response_headers: row.response_headers,
      response_body: row.response_body,
      status: row.status,
      retry_attempt: row.retry_attempt,
      latency_ms: row.latency_ms,
      error_message: row.error_message,
      error_code: row.error_code,
      error_category: row.error_category,
      queued_at: row.queued_at,
      delivered_at: row.delivered_at,
      next_retry_at: row.next_retry_at,
      created_at: row.created_at,
    },
    subscription: {
      id: row.subscription_id,
      webhook_url: row.subscription_webhook_url,
    },
    subscriber: {
      id: row.subscriber_id,
      name: row.subscriber_name,
      email: row.subscriber_email,
    },
    event: {
      event_id: row.event_event_id,
      event_type: row.event_event_type,
    },
  };
}