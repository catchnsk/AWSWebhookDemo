import { query } from '../utils/database';

/**
 * Schema interface
 */
export interface Schema {
  id: string;
  producer_id: string;
  schema_registry_id?: string;
  schema_registry_version?: number;
  name: string;
  event_type: string;
  version: string;
  schema_format: 'json' | 'avro' | 'protobuf';
  schema_definition: any;
  is_public: boolean;
  requires_approval: boolean;
  compatibility_mode: string;
  description?: string;
  documentation_url?: string;
  example_payload?: any;
  subscription_count: number;
  total_events_published: number;
  status: 'active' | 'deprecated' | 'disabled';
  created_at: Date;
  updated_at: Date;
  deprecated_at?: Date;
  schema_id?: string;
  domain?: 'payment' | 'account' | 'apply';
  partner_user_id?: string;
  system_user_id?: string;
}

/**
 * Create schema DTO
 */
export interface CreateSchemaDTO {
  producer_id: string;
  schema_registry_id?: string;
  schema_registry_version?: number;
  name: string;
  event_type: string;
  version: string;
  schema_format?: 'json' | 'avro' | 'protobuf';
  schema_definition: any;
  is_public?: boolean;
  requires_approval?: boolean;
  compatibility_mode?: string;
  description?: string;
  documentation_url?: string;
  example_payload?: any;
  domain?: 'payment' | 'account' | 'apply' | null;
  system_user_id?: string | null;
}

/**
 * Update schema DTO
 */
export interface UpdateSchemaDTO {
  description?: string;
  documentation_url?: string;
  example_payload?: any;
  schema_definition?: any;
  is_public?: boolean;
  requires_approval?: boolean;
  status?: 'active' | 'deprecated' | 'disabled';
  domain?: 'payment' | 'account' | 'apply' | null;
  partner_user_id?: string | null;
  system_user_id?: string | null;
}

/**
 * Create a new schema
 */
export async function createSchema(data: CreateSchemaDTO): Promise<Schema> {
  const result = await query<Schema>(
    `INSERT INTO schemas (
      producer_id, schema_registry_id, schema_registry_version, name, event_type,
      version, schema_format, schema_definition, is_public, requires_approval,
      compatibility_mode, description, documentation_url, example_payload, domain, system_user_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`,
    [
      data.producer_id,
      data.schema_registry_id || null,
      data.schema_registry_version || null,
      data.name,
      data.event_type,
      data.version,
      data.schema_format || 'json',
      JSON.stringify(data.schema_definition),
      data.is_public !== false,
      data.requires_approval || false,
      data.compatibility_mode || 'backward',
      data.description || null,
      data.documentation_url || null,
      data.example_payload ? JSON.stringify(data.example_payload) : null,
      data.domain || null,
      data.system_user_id || null,
    ]
  );

  return result.rows[0];
}

/**
 * Get schema by ID
 */
export async function getSchemaById(id: string): Promise<Schema | null> {
  const result = await query<Schema>(
    'SELECT * FROM schemas WHERE id = $1',
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Get schema by event type
 */
export async function getSchemaByEventType(eventType: string, version?: string): Promise<Schema | null> {
  let sql = 'SELECT * FROM schemas WHERE event_type = $1 AND status = $2';
  const params: any[] = [eventType, 'active'];

  if (version) {
    sql += ' AND version = $3';
    params.push(version);
  } else {
    sql += ' ORDER BY created_at DESC LIMIT 1';
  }

  const result = await query<Schema>(sql, params);

  return result.rows[0] || null;
}

/**
 * List schemas with filters and pagination
 */
export async function listSchemas(
  filters: {
    producer_id?: string;
    is_public?: boolean;
    status?: string;
    search?: string;
  } = {},
  page: number = 1,
  limit: number = 20
): Promise<{ schemas: Schema[]; total: number }> {
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.producer_id) {
    conditions.push(`producer_id = $${paramIndex}`);
    params.push(filters.producer_id);
    paramIndex++;
  }

  if (filters.is_public !== undefined) {
    conditions.push(`is_public = $${paramIndex}`);
    params.push(filters.is_public);
    paramIndex++;
  }

  if (filters.status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.search) {
    conditions.push(`(name ILIKE $${paramIndex} OR event_type ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM schemas ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated results
  const schemasResult = await query<Schema>(
    `SELECT * FROM schemas
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    schemas: schemasResult.rows,
    total,
  };
}

/**
 * List public schemas (marketplace)
 */
export async function listPublicSchemas(
  page: number = 1,
  limit: number = 20,
  search?: string
): Promise<{ schemas: Schema[]; total: number }> {
  return listSchemas(
    {
      is_public: true,
      status: 'active',
      search,
    },
    page,
    limit
  );
}

/**
 * Update schema
 */
export async function updateSchema(
  id: string,
  data: UpdateSchemaDTO
): Promise<Schema | null> {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex}`);
    params.push(data.description);
    paramIndex++;
  }

  if (data.documentation_url !== undefined) {
    updates.push(`documentation_url = $${paramIndex}`);
    params.push(data.documentation_url);
    paramIndex++;
  }

  if (data.example_payload !== undefined) {
    updates.push(`example_payload = $${paramIndex}`);
    params.push(JSON.stringify(data.example_payload));
    paramIndex++;
  }

  if (data.schema_definition !== undefined) {
    updates.push(`schema_definition = $${paramIndex}`);
    params.push(JSON.stringify(data.schema_definition));
    paramIndex++;
  }

  if (data.is_public !== undefined) {
    updates.push(`is_public = $${paramIndex}`);
    params.push(data.is_public);
    paramIndex++;
  }

  if (data.requires_approval !== undefined) {
    updates.push(`requires_approval = $${paramIndex}`);
    params.push(data.requires_approval);
    paramIndex++;
  }

  if (data.status !== undefined) {
    updates.push(`status = $${paramIndex}`);
    params.push(data.status);
    paramIndex++;

    if (data.status === 'deprecated') {
      updates.push(`deprecated_at = CURRENT_TIMESTAMP`);
    }
  }

  if (data.domain !== undefined) {
    updates.push(`domain = $${paramIndex}`);
    params.push(data.domain);
    paramIndex++;
  }

  if (data.partner_user_id !== undefined) {
    updates.push(`partner_user_id = $${paramIndex}`);
    params.push(data.partner_user_id);
    paramIndex++;
  }

  if (data.system_user_id !== undefined) {
    updates.push(`system_user_id = $${paramIndex}`);
    params.push(data.system_user_id);
    paramIndex++;
  }

  if (updates.length === 0) {
    return null;
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);

  const result = await query<Schema>(
    `UPDATE schemas
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    [...params, id]
  );

  return result.rows[0] || null;
}

/**
 * Increment event published count
 */
export async function incrementSchemaEventCount(schemaId: string): Promise<void> {
  await query(
    `UPDATE schemas
     SET total_events_published = total_events_published + 1
     WHERE id = $1`,
    [schemaId]
  );
}

/**
 * Get schema with producer details
 */
export async function getSchemaWithProducer(schemaId: string): Promise<{
  schema: Schema;
  producer: { id: string; name: string; contact_email: string };
} | null> {
  const result = await query(
    `SELECT
      s.*,
      p.id as producer_id,
      p.name as producer_name,
      p.contact_email as producer_email
     FROM schemas s
     JOIN producers p ON p.id = s.producer_id
     WHERE s.id = $1`,
    [schemaId]
  );

  if (!result.rows[0]) {
    return null;
  }

  const row = result.rows[0];

  return {
    schema: {
      id: row.id,
      producer_id: row.producer_id,
      schema_registry_id: row.schema_registry_id,
      schema_registry_version: row.schema_registry_version,
      name: row.name,
      event_type: row.event_type,
      version: row.version,
      schema_format: row.schema_format,
      schema_definition: row.schema_definition,
      is_public: row.is_public,
      requires_approval: row.requires_approval,
      compatibility_mode: row.compatibility_mode,
      description: row.description,
      documentation_url: row.documentation_url,
      example_payload: row.example_payload,
      subscription_count: row.subscription_count,
      total_events_published: row.total_events_published,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deprecated_at: row.deprecated_at,
    },
    producer: {
      id: row.producer_id,
      name: row.producer_name,
      contact_email: row.producer_email,
    },
  };
}

/**
 * Delete schema (soft delete)
 */
export async function deleteSchema(id: string): Promise<boolean> {
  const result = await query(
    'UPDATE schemas SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    ['disabled', id]
  );

  return result.rowCount > 0;
}