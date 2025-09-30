import { query } from '../utils/database';
import { generateApiKey, hashApiKey } from '../utils/crypto';

/**
 * Producer interface
 */
export interface Producer {
  id: string;
  name: string;
  description?: string;
  api_key: string;
  api_key_hash: string;
  contact_email: string;
  contact_name?: string;
  department?: string;
  status: 'active' | 'inactive' | 'suspended';
  total_events_published: number;
  total_schemas_registered: number;
  created_at: Date;
  updated_at: Date;
  last_published_at?: Date;
}

/**
 * Create producer DTO
 */
export interface CreateProducerDTO {
  name: string;
  description?: string;
  contact_email: string;
  contact_name?: string;
  department?: string;
}

/**
 * Update producer DTO
 */
export interface UpdateProducerDTO {
  name?: string;
  description?: string;
  contact_email?: string;
  contact_name?: string;
  department?: string;
  status?: 'active' | 'inactive' | 'suspended';
}

/**
 * Create a new producer
 */
export async function createProducer(data: CreateProducerDTO): Promise<{
  producer: Producer;
  apiKey: string;
}> {
  // Generate API key
  const apiKey = generateApiKey('wh_prod');
  const apiKeyHash = hashApiKey(apiKey);

  const result = await query<Producer>(
    `INSERT INTO producers (
      name, description, api_key, api_key_hash, contact_email, contact_name, department
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      data.name,
      data.description || null,
      apiKey,
      apiKeyHash,
      data.contact_email,
      data.contact_name || null,
      data.department || null,
    ]
  );

  return {
    producer: result.rows[0],
    apiKey, // Return plain API key only once
  };
}

/**
 * Get producer by ID
 */
export async function getProducerById(id: string): Promise<Producer | null> {
  const result = await query<Producer>(
    'SELECT * FROM producers WHERE id = $1',
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Get producer by API key hash
 */
export async function getProducerByApiKey(apiKey: string): Promise<Producer | null> {
  const apiKeyHash = hashApiKey(apiKey);

  const result = await query<Producer>(
    'SELECT * FROM producers WHERE api_key_hash = $1 AND status = $2',
    [apiKeyHash, 'active']
  );

  return result.rows[0] || null;
}

/**
 * List producers with pagination
 */
export async function listProducers(
  filters: {
    status?: string;
    search?: string;
  } = {},
  page: number = 1,
  limit: number = 20
): Promise<{ producers: Producer[]; total: number }> {
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
    conditions.push(`(name ILIKE $${paramIndex} OR contact_email ILIKE $${paramIndex})`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM producers ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated results
  const producersResult = await query<Producer>(
    `SELECT * FROM producers
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    producers: producersResult.rows,
    total,
  };
}

/**
 * Update producer
 */
export async function updateProducer(
  id: string,
  data: UpdateProducerDTO
): Promise<Producer | null> {
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

  if (data.contact_email !== undefined) {
    updates.push(`contact_email = $${paramIndex}`);
    params.push(data.contact_email);
    paramIndex++;
  }

  if (data.contact_name !== undefined) {
    updates.push(`contact_name = $${paramIndex}`);
    params.push(data.contact_name);
    paramIndex++;
  }

  if (data.department !== undefined) {
    updates.push(`department = $${paramIndex}`);
    params.push(data.department);
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

  const result = await query<Producer>(
    `UPDATE producers
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    [...params, id]
  );

  return result.rows[0] || null;
}

/**
 * Regenerate producer API key
 */
export async function regenerateProducerApiKey(id: string): Promise<{
  producer: Producer;
  apiKey: string;
}> {
  // Generate new API key
  const apiKey = generateApiKey('wh_prod');
  const apiKeyHash = hashApiKey(apiKey);

  const result = await query<Producer>(
    `UPDATE producers
     SET api_key = $1, api_key_hash = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [apiKey, apiKeyHash, id]
  );

  if (!result.rows[0]) {
    throw new Error('Producer not found');
  }

  return {
    producer: result.rows[0],
    apiKey,
  };
}

/**
 * Increment event published count
 */
export async function incrementEventPublishedCount(producerId: string): Promise<void> {
  await query(
    `UPDATE producers
     SET total_events_published = total_events_published + 1,
         last_published_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [producerId]
  );
}

/**
 * Increment schema registered count
 */
export async function incrementSchemaRegisteredCount(producerId: string): Promise<void> {
  await query(
    `UPDATE producers
     SET total_schemas_registered = total_schemas_registered + 1
     WHERE id = $1`,
    [producerId]
  );
}

/**
 * Delete producer (soft delete by setting status)
 */
export async function deleteProducer(id: string): Promise<boolean> {
  const result = await query(
    'UPDATE producers SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    ['inactive', id]
  );

  return result.rowCount > 0;
}