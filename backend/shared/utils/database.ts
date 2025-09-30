import { Pool, PoolClient, QueryResult } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

let pool: Pool | null = null;
let cachedPassword: string | null = null;
let passwordCachedAt: number = 0;
const PASSWORD_CACHE_TTL = parseInt(process.env.SECRETS_CACHE_TTL || '300000', 10); // 5 minutes

/**
 * Get database password from AWS Secrets Manager with caching
 */
async function getDatabasePassword(): Promise<string> {
  const now = Date.now();

  // Return cached password if still valid
  if (cachedPassword && (now - passwordCachedAt) < PASSWORD_CACHE_TTL) {
    return cachedPassword;
  }

  const secretArn = process.env.DATABASE_PASSWORD_SECRET_ARN;

  if (!secretArn) {
    // For local development, allow direct password
    const directPassword = process.env.DATABASE_PASSWORD;
    if (directPassword) {
      return directPassword;
    }
    throw new Error('DATABASE_PASSWORD_SECRET_ARN or DATABASE_PASSWORD must be set');
  }

  try {
    const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await client.send(command);

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    const secret = JSON.parse(response.SecretString);
    cachedPassword = secret.password || secret.DATABASE_PASSWORD;
    passwordCachedAt = now;

    return cachedPassword!;
  } catch (error) {
    console.error('Failed to retrieve database password from Secrets Manager:', error);
    throw error;
  }
}

/**
 * Initialize database connection pool
 */
export async function initializeDatabase(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  const password = await getDatabasePassword();

  pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Timeout for new connections
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  });

  // Test the connection
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }

  return pool;
}

/**
 * Get database connection pool
 */
export async function getPool(): Promise<Pool> {
  if (!pool) {
    return await initializeDatabase();
  }
  return pool;
}

/**
 * Execute a query with automatic connection handling
 */
export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const dbPool = await getPool();
  try {
    return await dbPool.query<T>(text, params);
  } catch (error) {
    console.error('Database query error:', { text, params, error });
    throw error;
  }
}

/**
 * Execute a transaction with automatic rollback on error
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const dbPool = await getPool();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction error, rolled back:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    cachedPassword = null;
    passwordCachedAt = 0;
    console.log('Database connection pool closed');
  }
}

/**
 * Build WHERE clause from filters
 */
export function buildWhereClause(
  filters: Record<string, any>,
  paramStartIndex: number = 1
): { clause: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = paramStartIndex;

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        // Handle array filters (IN clause)
        conditions.push(`${key} = ANY($${paramIndex})`);
        params.push(value);
      } else if (typeof value === 'string' && value.includes('%')) {
        // Handle LIKE filters
        conditions.push(`${key} LIKE $${paramIndex}`);
        params.push(value);
      } else {
        // Handle equality filters
        conditions.push(`${key} = $${paramIndex}`);
        params.push(value);
      }
      paramIndex++;
    }
  }

  const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { clause, params };
}

/**
 * Build pagination clause
 */
export function buildPaginationClause(page: number = 1, limit: number = 20): {
  limit: number;
  offset: number;
  clause: string;
} {
  const sanitizedLimit = Math.min(Math.max(1, limit), 100); // Max 100 items per page
  const sanitizedPage = Math.max(1, page);
  const offset = (sanitizedPage - 1) * sanitizedLimit;

  return {
    limit: sanitizedLimit,
    offset,
    clause: `LIMIT ${sanitizedLimit} OFFSET ${offset}`,
  };
}

/**
 * Build ORDER BY clause
 */
export function buildOrderByClause(
  sortBy: string = 'created_at',
  sortOrder: 'asc' | 'desc' = 'desc',
  allowedFields: string[] = ['created_at', 'updated_at', 'name']
): string {
  const sanitizedSortBy = allowedFields.includes(sortBy) ? sortBy : 'created_at';
  const sanitizedSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `ORDER BY ${sanitizedSortBy} ${sanitizedSortOrder}`;
}