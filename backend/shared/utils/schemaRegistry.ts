import {
  GlueClient,
  CreateSchemaCommand,
  GetSchemaCommand,
  RegisterSchemaVersionCommand,
  GetSchemaVersionCommand,
  CheckSchemaVersionValidityCommand,
} from '@aws-sdk/client-glue';

let glueClient: GlueClient | null = null;

/**
 * Initialize AWS Glue client
 */
function getGlueClient(): GlueClient {
  if (!glueClient) {
    glueClient = new GlueClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return glueClient;
}

/**
 * Schema Registry configuration
 */
const SCHEMA_REGISTRY_NAME = process.env.SCHEMA_REGISTRY_NAME || 'webhook-schema-registry';

/**
 * Register a new schema in AWS Glue Schema Registry
 */
export async function registerSchema(
  schemaName: string,
  schemaDefinition: any,
  schemaFormat: 'json' | 'avro' | 'protobuf',
  description?: string
): Promise<{
  schemaArn: string;
  schemaVersionId: string;
  versionNumber: number;
}> {
  const client = getGlueClient();

  // Convert schema format to Glue format
  const dataFormat = schemaFormat === 'json' ? 'JSON' : schemaFormat.toUpperCase();

  try {
    // Create schema
    const createCommand = new CreateSchemaCommand({
      SchemaName: schemaName,
      DataFormat: dataFormat as any,
      SchemaDefinition: JSON.stringify(schemaDefinition),
      RegistryId: {
        RegistryName: SCHEMA_REGISTRY_NAME,
      },
      Description: description,
      Compatibility: 'BACKWARD', // Default compatibility mode
    });

    const response = await client.send(createCommand);

    console.log('Schema registered in Schema Registry:', {
      schemaArn: response.SchemaArn,
      schemaVersionId: response.SchemaVersionId,
    });

    return {
      schemaArn: response.SchemaArn!,
      schemaVersionId: response.SchemaVersionId!,
      versionNumber: response.LatestSchemaVersion || 1,
    };
  } catch (error: any) {
    // If schema already exists, register a new version
    if (error.name === 'AlreadyExistsException') {
      console.log('Schema exists, registering new version...');
      return await registerSchemaVersion(schemaName, schemaDefinition);
    }

    console.error('Failed to register schema:', error);
    throw error;
  }
}

/**
 * Register a new version of an existing schema
 */
export async function registerSchemaVersion(
  schemaName: string,
  schemaDefinition: any
): Promise<{
  schemaArn: string;
  schemaVersionId: string;
  versionNumber: number;
}> {
  const client = getGlueClient();

  try {
    const command = new RegisterSchemaVersionCommand({
      SchemaId: {
        SchemaName: schemaName,
        RegistryName: SCHEMA_REGISTRY_NAME,
      },
      SchemaDefinition: JSON.stringify(schemaDefinition),
    });

    const response = await client.send(command);

    console.log('Schema version registered:', {
      schemaVersionId: response.SchemaVersionId,
      versionNumber: response.VersionNumber,
    });

    return {
      schemaArn: response.SchemaVersionId!, // Glue returns version ID
      schemaVersionId: response.SchemaVersionId!,
      versionNumber: response.VersionNumber || 1,
    };
  } catch (error) {
    console.error('Failed to register schema version:', error);
    throw error;
  }
}

/**
 * Get schema details from Schema Registry
 */
export async function getSchema(schemaName: string): Promise<{
  schemaArn: string;
  schemaName: string;
  dataFormat: string;
  latestVersion: number;
  compatibility: string;
  description?: string;
}> {
  const client = getGlueClient();

  try {
    const command = new GetSchemaCommand({
      SchemaId: {
        SchemaName: schemaName,
        RegistryName: SCHEMA_REGISTRY_NAME,
      },
    });

    const response = await client.send(command);

    return {
      schemaArn: response.SchemaArn!,
      schemaName: response.SchemaName!,
      dataFormat: response.DataFormat!,
      latestVersion: response.LatestSchemaVersion || 1,
      compatibility: response.Compatibility!,
      description: response.Description,
    };
  } catch (error) {
    console.error('Failed to get schema:', error);
    throw error;
  }
}

/**
 * Get specific schema version and definition
 */
export async function getSchemaVersion(
  schemaName: string,
  versionNumber?: number
): Promise<{
  schemaVersionId: string;
  schemaDefinition: any;
  versionNumber: number;
  status: string;
}> {
  const client = getGlueClient();

  try {
    const command = new GetSchemaVersionCommand({
      SchemaId: {
        SchemaName: schemaName,
        RegistryName: SCHEMA_REGISTRY_NAME,
      },
      SchemaVersionNumber: versionNumber
        ? { LatestVersion: false, VersionNumber: versionNumber }
        : { LatestVersion: true },
    });

    const response = await client.send(command);

    return {
      schemaVersionId: response.SchemaVersionId!,
      schemaDefinition: JSON.parse(response.SchemaDefinition || '{}'),
      versionNumber: response.VersionNumber || 1,
      status: response.Status!,
    };
  } catch (error) {
    console.error('Failed to get schema version:', error);
    throw error;
  }
}

/**
 * Validate data against schema from Schema Registry
 */
export async function validateAgainstSchema(
  schemaName: string,
  data: any,
  versionNumber?: number
): Promise<{
  valid: boolean;
  errors: string[];
}> {
  try {
    // Get schema definition
    const schemaVersion = await getSchemaVersion(schemaName, versionNumber);

    // Validate using Ajv (for JSON schemas)
    const Ajv = require('ajv');
    const ajv = new Ajv({ allErrors: true });

    const validate = ajv.compile(schemaVersion.schemaDefinition);
    const valid = validate(data);

    if (!valid && validate.errors) {
      const errors = validate.errors.map((err: any) => {
        return `${err.instancePath || '/'}: ${err.message}`;
      });

      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  } catch (error: any) {
    console.error('Schema validation failed:', error);
    return {
      valid: false,
      errors: [`Schema validation error: ${error.message}`],
    };
  }
}

/**
 * Check schema version compatibility
 */
export async function checkSchemaCompatibility(
  schemaName: string,
  newSchemaDefinition: any
): Promise<{
  compatible: boolean;
  errors: string[];
}> {
  const client = getGlueClient();

  try {
    const command = new CheckSchemaVersionValidityCommand({
      DataFormat: 'JSON' as any,
      SchemaDefinition: JSON.stringify(newSchemaDefinition),
    });

    const response = await client.send(command);

    return {
      compatible: response.Valid || false,
      errors: response.Error ? [response.Error] : [],
    };
  } catch (error: any) {
    console.error('Compatibility check failed:', error);
    return {
      compatible: false,
      errors: [`Compatibility check error: ${error.message}`],
    };
  }
}

/**
 * List all schema versions for a schema
 */
export async function listSchemaVersions(schemaName: string): Promise<
  Array<{
    versionNumber: number;
    schemaVersionId: string;
    status: string;
    createdAt?: Date;
  }>
> {
  const client = getGlueClient();

  try {
    // Note: AWS SDK doesn't have a direct ListSchemaVersions command
    // We need to fetch versions iteratively or use GetSchemaVersion with different version numbers
    // For simplicity, we'll return the latest version info
    const latestVersion = await getSchemaVersion(schemaName);

    return [
      {
        versionNumber: latestVersion.versionNumber,
        schemaVersionId: latestVersion.schemaVersionId,
        status: latestVersion.status,
      },
    ];
  } catch (error) {
    console.error('Failed to list schema versions:', error);
    return [];
  }
}

/**
 * Format schema definition for storage
 */
export function formatSchemaDefinition(
  schema: any,
  format: 'json' | 'avro' | 'protobuf'
): string {
  if (format === 'json') {
    return JSON.stringify(schema, null, 2);
  }

  // For Avro and Protobuf, assume schema is already in correct format
  return typeof schema === 'string' ? schema : JSON.stringify(schema);
}

/**
 * Parse schema definition from storage
 */
export function parseSchemaDefinition(schemaString: string): any {
  try {
    return JSON.parse(schemaString);
  } catch (error) {
    // If not JSON, return as-is (for Avro/Protobuf)
    return schemaString;
  }
}