import { APIGatewayProxyResult } from 'aws-lambda';

/**
 * API Response format
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  message?: string;
}

/**
 * Create success response
 */
export function successResponse<T = any>(
  data: T,
  statusCode: number = 200,
  message?: string
): APIGatewayProxyResult {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGINS?.split(',')[0] || '*',
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify(response),
  };
}

/**
 * Create error response
 */
export function errorResponse(
  code: string,
  message: string,
  statusCode: number = 400,
  details?: any
): APIGatewayProxyResult {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGINS?.split(',')[0] || '*',
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify(response),
  };
}

/**
 * Common error responses
 */
export const ErrorResponses = {
  badRequest: (message: string, details?: any) =>
    errorResponse('VALIDATION_ERROR', message, 400, details),

  unauthorized: (message: string = 'Missing or invalid authentication') =>
    errorResponse('UNAUTHORIZED', message, 401),

  forbidden: (message: string = 'Insufficient permissions') =>
    errorResponse('FORBIDDEN', message, 403),

  notFound: (resource: string, id: string) =>
    errorResponse('NOT_FOUND', `${resource} with ID '${id}' not found`, 404),

  conflict: (message: string) =>
    errorResponse('CONFLICT', message, 409),

  unprocessableEntity: (message: string, details?: any) =>
    errorResponse('SCHEMA_VALIDATION_FAILED', message, 422, details),

  rateLimitExceeded: (retryAfter: number = 60) =>
    errorResponse(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
      429,
      { retryAfter }
    ),

  internalServerError: (message: string = 'Internal server error') =>
    errorResponse('INTERNAL_SERVER_ERROR', message, 500),

  serviceUnavailable: (message: string = 'Service temporarily unavailable') =>
    errorResponse('SERVICE_UNAVAILABLE', message, 503),
};

/**
 * Pagination response format
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Create paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

/**
 * CORS preflight response
 */
export function corsPreflightResponse(): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGINS?.split(',')[0] || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Webhook-Signature',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
    body: '',
  };
}