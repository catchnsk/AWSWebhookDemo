import { query } from '../utils/database';

/**
 * Webhook execution interface
 */
export interface WebhookExecution {
  id: string;
  webhook_id: string;
  execution_id: string;
  request_url: string;
  request_method: string;
  request_headers?: any;
  request_payload?: any;
  response_status_code?: number;
  response_headers?: any;
  response_body?: string;
  status: 'queued' | 'processing' | 'success' | 'failed' | 'retrying' | 'timeout' | 'cancelled';
  retry_attempt: number;
  latency_ms?: number;
  error_message?: string;
  error_code?: string;
  queued_at: Date;
  started_at?: Date;
  completed_at?: Date;
  next_retry_at?: Date;
  created_at: Date;
}

/**
 * Create execution DTO
 */
export interface CreateExecutionDTO {
  webhook_id: string;
  execution_id: string;
  request_url: string;
  request_method?: string;
  request_headers?: any;
  request_payload?: any;
  status?: string;
  retry_attempt?: number;
}

/**
 * Update execution DTO
 */
export interface UpdateExecutionDTO {
  status?: string;
  response_status_code?: number;
  response_headers?: any;
  response_body?: string;
  latency_ms?: number;
  error_message?: string;
  error_code?: string;
  started_at?: Date;
  completed_at?: Date;
  next_retry_at?: Date;
}

/**
 * Create webhook execution record
 */
export async function createExecution(data: CreateExecutionDTO): Promise<WebhookExecution> {
  const result = await query<WebhookExecution>(
    `INSERT INTO webhook_executions (
      webhook_id, execution_id, request_url, request_method,
      request_headers, request_payload, status, retry_attempt
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      data.webhook_id,
      data.execution_id,
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
 * Get execution by ID
 */
export async function getExecutionById(executionId: string): Promise<WebhookExecution | null> {
  const result = await query<WebhookExecution>(
    'SELECT * FROM webhook_executions WHERE execution_id = $1',
    [executionId]
  );

  return result.rows[0] || null;
}

/**
 * Update execution
 */
export async function updateExecution(
  executionId: string,
  data: UpdateExecutionDTO
): Promise<WebhookExecution | null> {
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

  if (data.started_at !== undefined) {
    updates.push(`started_at = $${paramIndex}`);
    params.push(data.started_at);
    paramIndex++;
  }

  if (data.completed_at !== undefined) {
    updates.push(`completed_at = $${paramIndex}`);
    params.push(data.completed_at);
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

  const result = await query<WebhookExecution>(
    `UPDATE webhook_executions
     SET ${updates.join(', ')}
     WHERE execution_id = $${paramIndex}
     RETURNING *`,
    [...params, executionId]
  );

  return result.rows[0] || null;
}

/**
 * List executions for a webhook
 */
export async function listExecutions(
  webhookId: string,
  filters: {
    status?: string;
    from?: Date;
    to?: Date;
  } = {},
  page: number = 1,
  limit: number = 50
): Promise<{ executions: WebhookExecution[]; total: number }> {
  const offset = (page - 1) * limit;
  const conditions: string[] = ['webhook_id = $1'];
  const params: any[] = [webhookId];
  let paramIndex = 2;

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

  const whereClause = conditions.join(' AND ');

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM webhook_executions WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated results
  const executionsResult = await query<WebhookExecution>(
    `SELECT * FROM webhook_executions
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    executions: executionsResult.rows,
    total,
  };
}

/**
 * Get executions that need retry
 */
export async function getExecutionsForRetry(limit: number = 100): Promise<WebhookExecution[]> {
  const result = await query<WebhookExecution>(
    `SELECT * FROM webhook_executions
     WHERE status = 'retrying'
       AND next_retry_at <= CURRENT_TIMESTAMP
     ORDER BY next_retry_at ASC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}

/**
 * Move execution to dead letter queue
 */
export async function moveToDeadLetterQueue(execution: WebhookExecution): Promise<void> {
  await query(
    `INSERT INTO webhook_dead_letter_queue (
      webhook_id, execution_id, request_payload, request_url, request_headers,
      final_error_message, final_error_code, total_attempts,
      first_attempt_at, last_attempt_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      execution.webhook_id,
      execution.execution_id,
      execution.request_payload,
      execution.request_url,
      execution.request_headers,
      execution.error_message,
      execution.error_code,
      execution.retry_attempt + 1,
      execution.queued_at,
      new Date(),
    ]
  );
}