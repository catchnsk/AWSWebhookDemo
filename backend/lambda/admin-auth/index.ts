import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { verifyAdminPassword, updateAdminLastLogin } from '../../shared/models/admin';
import { successResponse, ErrorResponses, corsPreflightResponse } from '../../shared/utils/response';
import { initializeDatabase } from '../../shared/utils/database';

/**
 * Lambda handler for admin authentication (login)
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Admin Auth Lambda invoked', {
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
    if (method === 'POST' && (resource === '/admin/login' || path === '/api/v1/admin/login')) {
      return await handleLogin(event);
    }

    return ErrorResponses.badRequest('Invalid endpoint or method');
  } catch (error: any) {
    console.error('Error in admin auth:', error);
    return ErrorResponses.internalServerError(
      process.env.NODE_ENV === 'development' ? error.message : 'Operation failed'
    );
  }
}

/**
 * Handle admin login
 */
async function handleLogin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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

  // Validate login request
  const validation = validateLoginRequest(requestBody);
  if (!validation.valid) {
    return ErrorResponses.badRequest('Validation failed', validation.errors);
  }

  try {
    // Verify credentials
    const admin = await verifyAdminPassword(requestBody.email, requestBody.password);

    if (!admin) {
      return ErrorResponses.unauthorized('Invalid email or password');
    }

    // Update last login time
    await updateAdminLastLogin(admin.id);

    // Prepare response (excluding sensitive data)
    const response = {
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
      },
      apiKey: admin.api_key, // Return API key for subsequent requests
      message: 'Login successful',
    };

    return successResponse(response);
  } catch (error: any) {
    console.error('Failed to login:', error);
    throw error;
  }
}

/**
 * Validate login request
 */
function validateLoginRequest(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.email || typeof data.email !== 'string') {
    errors.push('email is required and must be a string');
  } else {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('email must be a valid email address');
    }
  }

  if (!data.password || typeof data.password !== 'string') {
    errors.push('password is required and must be a string');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
