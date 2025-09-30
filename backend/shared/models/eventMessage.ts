import { query } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Event Message interface
 */
export interface EventMessage {
  id: string;
  event_id: string;
  producer_id: string;
  schema_id: string;
  event_type: string;
  payload: any;
  correlation_id?: string;
  idempotency_key?: string;
  subscriber_count: number;
  deliveries_queued: number;
  deliveries_completed: number;
  deliveries_failed: number;
  published_at: Date;
  created_at: Date;
}

/**
 * Create event message DTO
 */
export interface CreateEventMessageDTO {
  producer_id: string;
  schema_id: string;
  event_type: string;
  payload: any;
  correlation_id?: string;
  idempotency_key?: string;
}

/**
 * Create a new event message
 */
export async function createEventMessage(data: CreateEventMessageDTO): Promise<EventMessage> {
  const eventId = `evt_${uuidv4().replace(/-/g, '')}`;

  const result = await query<EventMessage>(
    `INSERT INTO event_messages (
      event_id, producer_id, schema_id, event_type, payload,
      correlation_id, idempotency_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      eventId,
      data.producer_id,
      data.schema_id,
      data.event_type,
      JSON.stringify(data.payload),
      data.correlation_id || null,
      data.idempotency_key || null,
    ]
  );

  return result.rows[0];
}

/**
 * Get event message by ID
 */
export async function getEventMessageById(eventId: string): Promise<EventMessage | null> {
  const result = await query<EventMessage>(
    'SELECT * FROM event_messages WHERE event_id = $1',
    [eventId]
  );

  return result.rows[0] || null;
}

/**
 * Get event message by idempotency key
 */
export async function getEventMessageByIdempotencyKey(
  idempotencyKey: string
): Promise<EventMessage | null> {
  const result = await query<EventMessage>(
    'SELECT * FROM event_messages WHERE idempotency_key = $1',
    [idempotencyKey]
  );

  return result.rows[0] || null;
}

/**
 * List event messages for a producer
 */
export async function listEventMessages(
  filters: {
    producer_id?: string;
    schema_id?: string;
    event_type?: string;
    from?: Date;
    to?: Date;
  } = {},
  page: number = 1,
  limit: number = 50
): Promise<{ events: EventMessage[]; total: number }> {
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.producer_id) {
    conditions.push(`producer_id = $${paramIndex}`);
    params.push(filters.producer_id);
    paramIndex++;
  }

  if (filters.schema_id) {
    conditions.push(`schema_id = $${paramIndex}`);
    params.push(filters.schema_id);
    paramIndex++;
  }

  if (filters.event_type) {
    conditions.push(`event_type = $${paramIndex}`);
    params.push(filters.event_type);
    paramIndex++;
  }

  if (filters.from) {
    conditions.push(`published_at >= $${paramIndex}`);
    params.push(filters.from);
    paramIndex++;
  }

  if (filters.to) {
    conditions.push(`published_at <= $${paramIndex}`);
    params.push(filters.to);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM event_messages ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated results
  const eventsResult = await query<EventMessage>(
    `SELECT * FROM event_messages
     ${whereClause}
     ORDER BY published_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    events: eventsResult.rows,
    total,
  };
}

/**
 * Update event message delivery counts
 */
export async function updateEventMessageDeliveryCounts(
  eventId: string,
  updates: {
    subscriber_count?: number;
    deliveries_queued?: number;
    deliveries_completed?: number;
    deliveries_failed?: number;
  }
): Promise<void> {
  const updateFields: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (updates.subscriber_count !== undefined) {
    updateFields.push(`subscriber_count = $${paramIndex}`);
    params.push(updates.subscriber_count);
    paramIndex++;
  }

  if (updates.deliveries_queued !== undefined) {
    updateFields.push(`deliveries_queued = deliveries_queued + $${paramIndex}`);
    params.push(updates.deliveries_queued);
    paramIndex++;
  }

  if (updates.deliveries_completed !== undefined) {
    updateFields.push(`deliveries_completed = deliveries_completed + $${paramIndex}`);
    params.push(updates.deliveries_completed);
    paramIndex++;
  }

  if (updates.deliveries_failed !== undefined) {
    updateFields.push(`deliveries_failed = deliveries_failed + $${paramIndex}`);
    params.push(updates.deliveries_failed);
    paramIndex++;
  }

  if (updateFields.length === 0) {
    return;
  }

  await query(
    `UPDATE event_messages
     SET ${updateFields.join(', ')}
     WHERE event_id = $${paramIndex}`,
    [...params, eventId]
  );
}

/**
 * Get event with schema and producer details
 */
export async function getEventWithDetails(eventId: string): Promise<{
  event: EventMessage;
  schema: { id: string; name: string; event_type: string; version: string };
  producer: { id: string; name: string; contact_email: string };
} | null> {
  const result = await query(
    `SELECT
      e.*,
      s.id as schema_id,
      s.name as schema_name,
      s.event_type as schema_event_type,
      s.version as schema_version,
      p.id as producer_id,
      p.name as producer_name,
      p.contact_email as producer_email
     FROM event_messages e
     JOIN schemas s ON s.id = e.schema_id
     JOIN producers p ON p.id = e.producer_id
     WHERE e.event_id = $1`,
    [eventId]
  );

  if (!result.rows[0]) {
    return null;
  }

  const row = result.rows[0];

  return {
    event: {
      id: row.id,
      event_id: row.event_id,
      producer_id: row.producer_id,
      schema_id: row.schema_id,
      event_type: row.event_type,
      payload: row.payload,
      correlation_id: row.correlation_id,
      idempotency_key: row.idempotency_key,
      subscriber_count: row.subscriber_count,
      deliveries_queued: row.deliveries_queued,
      deliveries_completed: row.deliveries_completed,
      deliveries_failed: row.deliveries_failed,
      published_at: row.published_at,
      created_at: row.created_at,
    },
    schema: {
      id: row.schema_id,
      name: row.schema_name,
      event_type: row.schema_event_type,
      version: row.schema_version,
    },
    producer: {
      id: row.producer_id,
      name: row.producer_name,
      contact_email: row.producer_email,
    },
  };
}

/**
 * Get event delivery statistics
 */
export async function getEventDeliveryStats(eventId: string): Promise<{
  totalSubscribers: number;
  deliveriesQueued: number;
  deliveriesCompleted: number;
  deliveriesFailed: number;
  successRate: number;
  status: 'pending' | 'in_progress' | 'completed' | 'partial_failure' | 'failed';
}> {
  const event = await getEventMessageById(eventId);

  if (!event) {
    throw new Error('Event not found');
  }

  const totalDeliveries = event.deliveries_completed + event.deliveries_failed;
  const successRate =
    totalDeliveries > 0 ? (event.deliveries_completed / totalDeliveries) * 100 : 0;

  let status: 'pending' | 'in_progress' | 'completed' | 'partial_failure' | 'failed';

  if (totalDeliveries === 0) {
    status = 'pending';
  } else if (totalDeliveries < event.subscriber_count) {
    status = 'in_progress';
  } else if (event.deliveries_failed === 0) {
    status = 'completed';
  } else if (event.deliveries_completed > 0) {
    status = 'partial_failure';
  } else {
    status = 'failed';
  }

  return {
    totalSubscribers: event.subscriber_count,
    deliveriesQueued: event.deliveries_queued,
    deliveriesCompleted: event.deliveries_completed,
    deliveriesFailed: event.deliveries_failed,
    successRate: Math.round(successRate * 100) / 100,
    status,
  };
}