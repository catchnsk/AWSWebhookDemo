import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createSchema, getSchemaById, listSchemas, listPublicSchemas } from '../../shared/models/schema';
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

    // Route based on method and resource
    if (method === 'POST' && resource === '/schemas/register') {
      return await handleRegisterSchema(event);
    }

    if (method === 'GET' && resource === '/schemas') {
      return await handleListSchemas(event);
    }

    if (method === 'GET' && resource === '/schemas/marketplace') {
      return await handleListMarketplace(event);
    }

    if (method === 'GET' && resource === '/schemas/{schemaId}') {
      return await handleGetSchema(event);
    }

    if (method === 'POST' && resource === '/schemas/{schemaId}/validate') {
      return await handleValidatePayload(event);
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
  // Extract API key from Authorization header
  const apiKey = event.headers['Authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    return ErrorResponses.unauthorized('API key is required');
  }

  // Validate producer
  const producer = await getProducerByApiKey(apiKey);

  if (!producer) {
    return ErrorResponses.unauthorized('Invalid API key');
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
    // Step 1: Register schema in AWS Glue Schema Registry
    console.log('Registering schema in Schema Registry...');
    const registryResult = await registerSchema(
      requestBody.name,
      requestBody.schemaDefinition,
      requestBody.schemaFormat || 'json',
      requestBody.description
    );

    console.log('Schema registered in Registry:', {
      schemaArn: registryResult.schemaArn,
      versionNumber: registryResult.versionNumber,
    });

    // Step 2: Store schema metadata in Webhook Database
    console.log('Storing schema in Webhook DB...');
    const schema = await createSchema({
      producer_id: producer.id,
      schema_registry_id: registryResult.schemaArn,
      schema_registry_version: registryResult.versionNumber,
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
      message: 'Schema registered successfully in both Schema Registry and Webhook Database',
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
  const apiKey = event.headers['Authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    return ErrorResponses.unauthorized('API key is required');
  }

  const producer = await getProducerByApiKey(apiKey);

  if (!producer) {
    return ErrorResponses.unauthorized('Invalid API key');
  }

  const params = event.queryStringParameters || {};
  const page = parseInt(params.page || '1', 10);
  const limit = parseInt(params.limit || '20', 10);

  const filters: any = { producer_id: producer.id };

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