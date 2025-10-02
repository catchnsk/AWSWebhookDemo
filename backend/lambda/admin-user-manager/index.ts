import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  createAdmin,
  getAdminById,
  listAdmins,
  updateAdmin,
  deleteAdmin,
  getAdminByEmail
} from '../../shared/models/admin';
import { successResponse, ErrorResponses, corsPreflightResponse, paginatedResponse } from '../../shared/utils/response';
import { initializeDatabase } from '../../shared/utils/database';

/**
 * Lambda handler for admin user management
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Admin User Manager Lambda invoked', {
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
    if (method === 'POST' && (resource === '/admin/users' || path === '/api/v1/admin/users')) {
      return await handleCreateAdmin(event);
    }

    if (method === 'GET' && (resource === '/admin/users' || path === '/api/v1/admin/users')) {
      return await handleListAdmins(event);
    }

    if (method === 'GET' && (resource === '/admin/users/{userId}' || path.includes('/api/v1/admin/users/'))) {
      return await handleGetAdmin(event);
    }

    if (method === 'PATCH' && (resource === '/admin/users/{userId}' || path.includes('/api/v1/admin/users/'))) {
      return await handleUpdateAdmin(event);
    }

    if (method === 'DELETE' && (resource === '/admin/users/{userId}' || path.includes('/api/v1/admin/users/'))) {
      return await handleDeleteAdmin(event);
    }

    return ErrorResponses.badRequest('Invalid endpoint or method');
  } catch (error: any) {
    console.error('Error in admin user manager:', error);
    return ErrorResponses.internalServerError(
      process.env.NODE_ENV === 'development' ? error.message : 'Operation failed'
    );
  }
}

/**
 * Handle create admin user
 */
async function handleCreateAdmin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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

  // Validate admin creation request
  const validation = validateAdminCreation(requestBody);
  if (!validation.valid) {
    return ErrorResponses.badRequest('Validation failed', validation.errors);
  }

  try {
    // Check if email already exists
    const existingAdmin = await getAdminByEmail(requestBody.email);
    if (existingAdmin) {
      return ErrorResponses.conflict('An admin with this email already exists');
    }

    // Create admin
    const { admin, apiKey } = await createAdmin({
      name: requestBody.name,
      email: requestBody.email,
      password: requestBody.password,
      role: requestBody.role || 'admin',
    });

    // Prepare response
    const response = {
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        createdAt: admin.created_at,
      },
      apiKey, // Return API key only once
      message: 'Admin user created successfully. Please save the API key securely as it will not be shown again.',
    };

    return successResponse(response, 201);
  } catch (error: any) {
    console.error('Failed to create admin:', error);

    // Check for unique constraint violation
    if (error.code === '23505') {
      return ErrorResponses.conflict('An admin with this email already exists');
    }

    throw error;
  }
}

/**
 * Handle list admins
 */
async function handleListAdmins(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const page = parseInt(params.page || '1', 10);
  const limit = parseInt(params.limit || '20', 10);

  const filters: any = {};

  if (params.status) filters.status = params.status;
  if (params.role) filters.role = params.role;
  if (params.search) filters.search = params.search;

  const { admins, total } = await listAdmins(filters, page, limit);

  const transformedAdmins = admins.map((admin) => ({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    status: admin.status,
    lastLoginAt: admin.last_login_at,
    createdAt: admin.created_at,
    updatedAt: admin.updated_at,
  }));

  const response = paginatedResponse(transformedAdmins, total, page, limit);

  return successResponse({ ...response, admins: response.data });
}

/**
 * Handle get admin details
 */
async function handleGetAdmin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = event.pathParameters?.userId;

  if (!userId) {
    return ErrorResponses.badRequest('User ID is required');
  }

  const admin = await getAdminById(userId);

  if (!admin) {
    return ErrorResponses.notFound('Admin user', userId);
  }

  const response = {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    status: admin.status,
    lastLoginAt: admin.last_login_at,
    createdAt: admin.created_at,
    updatedAt: admin.updated_at,
  };

  return successResponse(response);
}

/**
 * Handle update admin
 */
async function handleUpdateAdmin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = event.pathParameters?.userId;

  if (!userId) {
    return ErrorResponses.badRequest('User ID is required');
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

  const updateData: any = {};

  if (requestBody.name !== undefined) updateData.name = requestBody.name;
  if (requestBody.email !== undefined) updateData.email = requestBody.email;
  if (requestBody.role !== undefined) updateData.role = requestBody.role;
  if (requestBody.status !== undefined) updateData.status = requestBody.status;

  // Handle password update if provided
  if (requestBody.password) {
    if (requestBody.password.length < 6) {
      return ErrorResponses.badRequest('Password must be at least 6 characters long');
    }
    console.log('Updating password for user:', userId);
    updateData.password = requestBody.password;
  }

  console.log('Update data:', { ...updateData, password: updateData.password ? '[REDACTED]' : undefined });
  const admin = await updateAdmin(userId, updateData);
  console.log('Admin updated successfully, has password:', !!admin?.password_hash);

  if (!admin) {
    return ErrorResponses.notFound('Admin user', userId);
  }

  const response = {
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      status: admin.status,
      lastLoginAt: admin.last_login_at,
      createdAt: admin.created_at,
      updatedAt: admin.updated_at,
    },
    message: 'Admin user updated successfully',
  };

  return successResponse(response);
}

/**
 * Handle delete admin (soft delete)
 */
async function handleDeleteAdmin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = event.pathParameters?.userId;

  if (!userId) {
    return ErrorResponses.badRequest('User ID is required');
  }

  const result = await deleteAdmin(userId);

  if (!result) {
    return ErrorResponses.notFound('Admin user', userId);
  }

  return successResponse({
    message: 'Admin user deleted successfully',
  });
}

/**
 * Validate admin creation request
 */
function validateAdminCreation(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== 'string') {
    errors.push('name is required and must be a string');
  }

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
  } else if (data.password.length < 6) {
    errors.push('password must be at least 6 characters long');
  }

  if (data.role && !['super_admin', 'admin', 'viewer', 'tester', 'rtb'].includes(data.role)) {
    errors.push('role must be one of: super_admin, admin, viewer, tester, rtb');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
