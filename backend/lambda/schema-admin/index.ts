import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createSchema, getSchemaById, listSchemas, listPublicSchemas, updateSchema } from '../../shared/models/schema';
import { getProducerByApiKey, incrementSchemaRegisteredCount } from '../../shared/models/producer';
import { registerSchema, validateAgainstSchema } from '../../shared/utils/schemaRegistry';
import { successResponse, ErrorResponses, corsPreflightResponse, paginatedResponse } from '../../shared/utils/response';
import { initializeDatabase } from '../../shared/utils/database';

/**
 * Lambda handler for schema registration and management
 *
 * Requirements 1b & 2: Publish the schema, Register in DB and Schema Registry
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Schema Admin Lambda invoked', {
    httpMethod: event.httpMethod,
    path: event.path,
    resource: event.resource,
  });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    // Initialize database
    await initializeDatabase();

    const method = event.httpMethod;
    const resource = event.resource;
    const path = event.path;

    // Route based on method and resource/path
    if (method === 'POST' && (resource === '/schemas/register' || path === '/api/v1/schemas/register')) {
      return await handleRegisterSchema(event);
    }

    if (method === 'GET' && (resource === '/schemas' || path === '/api/v1/schemas')) {
      return await handleListSchemas(event);
    }

    if (method === 'GET' && (resource === '/schemas/marketplace' || path === '/api/v1/schemas/marketplace')) {
      return await handleListMarketplace(event);
    }

    if (method === 'GET' && (resource === '/schemas/{schemaId}' || path.includes('/api/v1/schemas/'))) {
      return await handleGetSchema(event);
    }

    if (method === 'POST' && (resource === '/schemas/{schemaId}/validate' || path.includes('/api/v1/schemas/') && path.includes('/validate'))) {
      return await handleValidatePayload(event);
    }

    if (method === 'PATCH' && (resource === '/admin/schemas/{schemaId}' || path.includes('/api/v1/admin/schemas/'))) {
      return await handleUpdateSchema(event);
    }

    return ErrorResponses.badRequest('Invalid endpoint or method');
  } catch (error: any) {
    console.error('Error in schema admin:', error);
    return ErrorResponses.internalServerError(
      process.env.NODE_ENV === 'development' ? error.message : 'Operation failed'
    );
  }
}

/**
 * Handle schema registration
 * Requirement 1b: Publish the schema
 * Requirement 2a: Register the schema in Webhook DB
 * Requirement 2b: Register the schema in Schema Registry
 */
async function handleRegisterSchema(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Extract API key from Authorization header or X-API-Key
  const apiKey = event.headers['Authorization']?.replace('Bearer ', '') || event.headers['x-api-key'] || event.headers['X-API-Key'];

  if (!apiKey) {
    return ErrorResponses.unauthorized('API key is required');
  }

  // Check if admin (admin API keys start with 'wh_admin')
  const isAdmin = apiKey.startsWith('wh_admin');

  let producer;

  if (isAdmin) {
    // For admin users, create or use a default "System" producer
    // First, try to find existing system producer
    const { query } = await import('../../shared/utils/database');
    const result = await query(
      'SELECT * FROM producers WHERE name = $1 LIMIT 1',
      ['System']
    );

    if (result.rows.length > 0) {
      producer = result.rows[0];
    } else {
      // Create a system producer
      const createResult = await query(
        `INSERT INTO producers (name, contact_email, api_key, status)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        ['System', 'system@webhook.local', 'system_internal_key', 'active']
      );
      producer = createResult.rows[0];
    }
  } else {
    // Validate producer
    producer = await getProducerByApiKey(apiKey);

    if (!producer) {
      return ErrorResponses.unauthorized('Invalid API key');
    }
  }

  // Parse request body
  if (!event.body) {
    return ErrorResponses.badRequest('Request body is required');
  }

  let requestBody: any;
  try {
    requestBody = JSON.parse(event.body);
  } catch (error) {
    return ErrorResponses.badRequest('Invalid JSON in request body');
  }

  // Validate schema registration request
  const validation = validateSchemaRegistration(requestBody);
  if (!validation.valid) {
    return ErrorResponses.badRequest('Validation failed', validation.errors);
  }

  try {
    let registryResult = null;

    // Step 1: Register schema in AWS Glue Schema Registry (only if not in local dev)
    const isLocalDev = process.env.NODE_ENV === 'development' || !process.env.AWS_REGION;

    if (!isLocalDev) {
      console.log('Registering schema in Schema Registry...');
      registryResult = await registerSchema(
        requestBody.name,
        requestBody.schemaDefinition,
        requestBody.schemaFormat || 'json',
        requestBody.description
      );

      console.log('Schema registered in Registry:', {
        schemaArn: registryResult.schemaArn,
        versionNumber: registryResult.versionNumber,
      });
    } else {
      console.log('Local development mode: Skipping AWS Schema Registry registration');
    }

    // Step 2: Store schema metadata in Webhook Database
    console.log('Storing schema in Webhook DB...');
    const schema = await createSchema({
      producer_id: producer.id,
      schema_registry_id: registryResult?.schemaArn || null,
      schema_registry_version: registryResult?.versionNumber || null,
      name: requestBody.name,
      event_type: requestBody.eventType,
      version: requestBody.version,
      schema_format: requestBody.schemaFormat || 'json',
      schema_definition: requestBody.schemaDefinition,
      is_public: requestBody.isPublic !== false,
      requires_approval: requestBody.requiresApproval || false,
      description: requestBody.description,
      documentation_url: requestBody.documentationUrl,
      example_payload: requestBody.examplePayload,
      domain: requestBody.domain || null,
      system_user_id: requestBody.systemUserId || null,
    });

    // Step 3: Increment producer's schema count
    await incrementSchemaRegisteredCount(producer.id);

    // Prepare response
    const response = {
      schema: {
        id: schema.id,
        producerId: schema.producer_id,
        schemaRegistryId: schema.schema_registry_id,
        name: schema.name,
        eventType: schema.event_type,
        version: schema.version,
        schemaFormat: schema.schema_format,
        isPublic: schema.is_public,
        requiresApproval: schema.requires_approval,
        description: schema.description,
        documentationUrl: schema.documentation_url,
        status: schema.status,
        createdAt: schema.created_at,
      },
      message: isLocalDev
        ? 'Schema registered successfully in Webhook Database (local development mode)'
        : 'Schema registered successfully in both Schema Registry and Webhook Database',
    };

    return successResponse(response, 201);
  } catch (error: any) {
    console.error('Failed to register schema:', error);

    // Check for unique constraint violation
    if (error.code === '23505') {
      return ErrorResponses.conflict('A schema with this event type already exists');
    }

    throw error;
  }
}

/**
 * Handle list schemas
 */
async function handleListSchemas(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const apiKey = event.headers['Authorization']?.replace('Bearer ', '') || event.headers['x-api-key'] || event.headers['X-API-Key'];

  if (!apiKey) {
    return ErrorResponses.unauthorized('API key is required');
  }

  // Check if admin (admin API keys start with 'wh_admin')
  const isAdmin = apiKey.startsWith('wh_admin');

  let producer = null;
  if (!isAdmin) {
    producer = await getProducerByApiKey(apiKey);
    if (!producer) {
      return ErrorResponses.unauthorized('Invalid API key');
    }
  }

  const params = event.queryStringParameters || {};
  const page = parseInt(params.page || '1', 10);
  const limit = parseInt(params.limit || '20', 10);

  const filters: any = {};

  // If not admin, filter by producer
  if (producer) {
    filters.producer_id = producer.id;
  }

  if (params.status) filters.status = params.status;
  if (params.search) filters.search = params.search;

  const { schemas, total } = await listSchemas(filters, page, limit);

  const transformedSchemas = schemas.map((schema) => ({
    id: schema.id,
    name: schema.name,
    eventType: schema.event_type,
    version: schema.version,
    schemaFormat: schema.schema_format,
    isPublic: schema.is_public,
    subscriptionCount: schema.subscription_count,
    totalEventsPublished: schema.total_events_published,
    status: schema.status,
    createdAt: schema.created_at,
    schemaId: schema.schema_id,
    domain: schema.domain,
    partnerUserId: schema.partner_user_id,
    systemUserId: schema.system_user_id,
  }));

  const response = paginatedResponse(transformedSchemas, total, page, limit);

  return successResponse({ ...response, schemas: response.data });
}

/**
 * Handle list public schemas (marketplace)
 * Requirement 3: Partner subscribes to a schema via API Exchange
 */
async function handleListMarketplace(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const page = parseInt(params.page || '1', 10);
  const limit = parseInt(params.limit || '20', 10);
  const search = params.search;

  const { schemas, total } = await listPublicSchemas(page, limit, search);

  const transformedSchemas = schemas.map((schema) => ({
    id: schema.id,
    name: schema.name,
    eventType: schema.event_type,
    version: schema.version,
    description: schema.description,
    documentationUrl: schema.documentation_url,
    examplePayload: schema.example_payload,
    subscriptionCount: schema.subscription_count,
    schemaFormat: schema.schema_format,
    requiresApproval: schema.requires_approval,
    createdAt: schema.created_at,
    schemaId: schema.schema_id,
    domain: schema.domain,
    partnerUserId: schema.partner_user_id,
    systemUserId: schema.system_user_id,
  }));

  const response = paginatedResponse(transformedSchemas, total, page, limit);

  return successResponse({ ...response, schemas: response.data });
}

/**
 * Handle get schema details
 */
async function handleGetSchema(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const schemaId = event.pathParameters?.schemaId;

  if (!schemaId) {
    return ErrorResponses.badRequest('Schema ID is required');
  }

  const schema = await getSchemaById(schemaId);

  if (!schema) {
    return ErrorResponses.notFound('Schema', schemaId);
  }

  const response = {
    id: schema.id,
    producerId: schema.producer_id,
    schemaRegistryId: schema.schema_registry_id,
    name: schema.name,
    eventType: schema.event_type,
    version: schema.version,
    schemaFormat: schema.schema_format,
    schemaDefinition: schema.schema_definition,
    isPublic: schema.is_public,
    requiresApproval: schema.requires_approval,
    description: schema.description,
    documentationUrl: schema.documentation_url,
    examplePayload: schema.example_payload,
    subscriptionCount: schema.subscription_count,
    totalEventsPublished: schema.total_events_published,
    status: schema.status,
    createdAt: schema.created_at,
    updatedAt: schema.updated_at,
    schemaId: schema.schema_id,
    domain: schema.domain,
    partnerUserId: schema.partner_user_id,
    systemUserId: schema.system_user_id,
  };

  return successResponse(response);
}

/**
 * Handle payload validation against schema
 */
async function handleValidatePayload(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const schemaId = event.pathParameters?.schemaId;

  if (!schemaId) {
    return ErrorResponses.badRequest('Schema ID is required');
  }

  if (!event.body) {
    return ErrorResponses.badRequest('Request body is required');
  }

  let requestBody: any;
  try {
    requestBody = JSON.parse(event.body);
  } catch (error) {
    return ErrorResponses.badRequest('Invalid JSON in request body');
  }

  const schema = await getSchemaById(schemaId);

  if (!schema) {
    return ErrorResponses.notFound('Schema', schemaId);
  }

  // Validate against schema from Schema Registry
  const validationResult = await validateAgainstSchema(
    schema.name,
    requestBody.payload,
    schema.schema_registry_version
  );

  if (!validationResult.valid) {
    return successResponse(
      {
        valid: false,
        errors: validationResult.errors,
      },
      400
    );
  }

  return successResponse({
    valid: true,
    message: 'Payload is valid according to the schema',
  });
}

/**
 * Handle update schema (admin only)
 */
async function handleUpdateSchema(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Extract API key from headers
  const apiKey = event.headers['Authorization']?.replace('Bearer ', '') || event.headers['x-api-key'] || event.headers['X-API-Key'];

  if (!apiKey) {
    return ErrorResponses.unauthorized('API key is required');
  }

  // Check if admin (admin API keys start with 'wh_admin')
  const isAdmin = apiKey.startsWith('wh_admin');

  if (!isAdmin) {
    return ErrorResponses.unauthorized('Admin access required');
  }

  const schemaId = event.pathParameters?.schemaId;

  if (!schemaId) {
    return ErrorResponses.badRequest('Schema ID is required');
  }

  if (!event.body) {
    return ErrorResponses.badRequest('Request body is required');
  }

  let requestBody: any;
  try {
    requestBody = JSON.parse(event.body);
  } catch (error) {
    return ErrorResponses.badRequest('Invalid JSON in request body');
  }

  // Validate schema exists
  const schema = await getSchemaById(schemaId);

  if (!schema) {
    return ErrorResponses.notFound('Schema', schemaId);
  }

  // Update schema
  const updateData: any = {};

  if (requestBody.domain !== undefined) {
    updateData.domain = requestBody.domain;
  }

  if (requestBody.partnerUserId !== undefined) {
    updateData.partner_user_id = requestBody.partnerUserId;
  }

  if (requestBody.systemUserId !== undefined) {
    updateData.system_user_id = requestBody.systemUserId;
  }

  if (requestBody.status !== undefined) {
    updateData.status = requestBody.status;
  }

  if (requestBody.schemaDefinition !== undefined) {
    updateData.schema_definition = requestBody.schemaDefinition;
  }

  if (requestBody.examplePayload !== undefined) {
    updateData.example_payload = requestBody.examplePayload;
  }

  const updatedSchema = await updateSchema(schemaId, updateData);

  if (!updatedSchema) {
    return ErrorResponses.internalServerError('Failed to update schema');
  }

  const response = {
    id: updatedSchema.id,
    producerId: updatedSchema.producer_id,
    schemaRegistryId: updatedSchema.schema_registry_id,
    name: updatedSchema.name,
    eventType: updatedSchema.event_type,
    version: updatedSchema.version,
    schemaFormat: updatedSchema.schema_format,
    schemaDefinition: updatedSchema.schema_definition,
    isPublic: updatedSchema.is_public,
    requiresApproval: updatedSchema.requires_approval,
    description: updatedSchema.description,
    documentationUrl: updatedSchema.documentation_url,
    examplePayload: updatedSchema.example_payload,
    subscriptionCount: updatedSchema.subscription_count,
    totalEventsPublished: updatedSchema.total_events_published,
    status: updatedSchema.status,
    createdAt: updatedSchema.created_at,
    updatedAt: updatedSchema.updated_at,
    schemaId: updatedSchema.schema_id,
    domain: updatedSchema.domain,
    partnerUserId: updatedSchema.partner_user_id,
    systemUserId: updatedSchema.system_user_id,
  };

  return successResponse(response);
}

/**
 * Validate schema registration request
 */
function validateSchemaRegistration(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  if (!data.eventType || typeof data.eventType !== 'string') {
    errors.push('eventType is required and must be a string');
  }

  if (!data.version || typeof data.version !== 'string') {
    errors.push('version is required and must be a string');
  }

  if (!data.schemaDefinition || typeof data.schemaDefinition !== 'object') {
    errors.push('schemaDefinition is required and must be an object');
  }

  if (data.schemaFormat && !['json', 'avro', 'protobuf'].includes(data.schemaFormat)) {
    errors.push('schemaFormat must be one of: json, avro, protobuf');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}