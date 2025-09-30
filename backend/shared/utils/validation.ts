import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

/**
 * Validate data against JSON schema
 */
export function validateSchema(schema: any, data: any): {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
} {
  let validate: ValidateFunction;

  try {
    validate = ajv.compile(schema);
  } catch (error: any) {
    return {
      valid: false,
      errors: [{ path: '', message: `Invalid schema: ${error.message}` }],
    };
  }

  const valid = validate(data);

  if (!valid && validate.errors) {
    const errors = validate.errors.map((err) => ({
      path: err.instancePath || `/${err.params?.missingProperty || 'root'}`,
      message: err.message || 'Validation failed',
    }));

    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Validate webhook payload
 */
export function validateWebhookPayload(payload: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object') {
    errors.push('Payload must be a valid object');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate webhook configuration
 */
export function validateWebhookConfig(config: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate name
  if (!config.name || typeof config.name !== 'string') {
    errors.push('Name is required and must be a string');
  } else if (config.name.length > 255) {
    errors.push('Name must not exceed 255 characters');
  }

  // Validate URL
  if (!config.url || typeof config.url !== 'string') {
    errors.push('URL is required and must be a string');
  } else if (!isValidUrl(config.url)) {
    errors.push('URL must be a valid HTTP or HTTPS URL');
  }

  // Validate event type
  if (!config.eventType || typeof config.eventType !== 'string') {
    errors.push('Event type is required and must be a string');
  }

  // Validate authentication type
  if (config.authentication?.type) {
    const validAuthTypes = ['bearer', 'api_key', 'oauth2', 'basic', 'none'];
    if (!validAuthTypes.includes(config.authentication.type)) {
      errors.push(`Authentication type must be one of: ${validAuthTypes.join(', ')}`);
    }
  }

  // Validate retry policy
  if (config.retryPolicy) {
    if (typeof config.retryPolicy.maxRetries === 'number') {
      if (config.retryPolicy.maxRetries < 0 || config.retryPolicy.maxRetries > 10) {
        errors.push('Max retries must be between 0 and 10');
      }
    }

    if (config.retryPolicy.backoffStrategy) {
      const validStrategies = ['exponential', 'linear', 'constant'];
      if (!validStrategies.includes(config.retryPolicy.backoffStrategy)) {
        errors.push(`Backoff strategy must be one of: ${validStrategies.join(', ')}`);
      }
    }

    if (typeof config.retryPolicy.initialDelayMs === 'number') {
      if (config.retryPolicy.initialDelayMs < 100) {
        errors.push('Initial delay must be at least 100ms');
      }
    }
  }

  // Validate timeout
  if (config.timeoutMs !== undefined) {
    if (typeof config.timeoutMs !== 'number' || config.timeoutMs < 1000 || config.timeoutMs > 300000) {
      errors.push('Timeout must be between 1000ms and 300000ms');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize input string
 */
export function sanitizeString(input: string, maxLength: number = 255): string {
  return input.trim().substring(0, maxLength);
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page?: any, limit?: any): {
  page: number;
  limit: number;
  errors: string[];
} {
  const errors: string[] = [];
  let validPage = 1;
  let validLimit = 20;

  if (page !== undefined) {
    const parsedPage = parseInt(page, 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      errors.push('Page must be a positive integer');
    } else {
      validPage = parsedPage;
    }
  }

  if (limit !== undefined) {
    const parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      errors.push('Limit must be a positive integer');
    } else if (parsedLimit > 100) {
      errors.push('Limit must not exceed 100');
    } else {
      validLimit = parsedLimit;
    }
  }

  return { page: validPage, limit: validLimit, errors };
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID format
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}