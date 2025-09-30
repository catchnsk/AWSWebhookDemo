import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createProducer, getProducerById } from '../../shared/models/producer';
import { successResponse, ErrorResponses, corsPreflightResponse } from '../../shared/utils/response';
import { isValidEmail } from '../../shared/utils/validation';
import { sendProducerWelcomeEmail } from '../../shared/utils/email';
import { initializeDatabase } from '../../shared/utils/database';

/**
 * Lambda handler for producer onboarding
 *
 * Requirement 1: Message Schema Registration by Producers - Onboarding Process
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Producer Onboarding Lambda invoked', {
    httpMethod: event.httpMethod,
    path: event.path,
  });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    // Initialize database connection
    await initializeDatabase();

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
      return ErrorResponses.badRequest('Method not allowed');
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

    // Validate required fields
    const validation = validateProducerOnboarding(requestBody);
    if (!validation.valid) {
      return ErrorResponses.badRequest('Validation failed', validation.errors);
    }

    // Create producer
    const { producer, apiKey } = await createProducer({
      name: requestBody.name,
      description: requestBody.description,
      contact_email: requestBody.contactEmail,
      contact_name: requestBody.contactName,
      department: requestBody.department,
    });

    // Send welcome email with API credentials
    try {
      await sendProducerWelcomeEmail(
        producer.contact_email,
        requestBody.contactName || requestBody.name,
        apiKey,
        process.env.DOCS_URL || 'https://docs.webhooks.example.com'
      );
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the request if email fails
    }

    // Prepare response (API key is shown only once!)
    const response = {
      producer: {
        id: producer.id,
        name: producer.name,
        description: producer.description,
        contactEmail: producer.contact_email,
        contactName: producer.contact_name,
        department: producer.department,
        status: producer.status,
        createdAt: producer.created_at,
      },
      apiKey, // IMPORTANT: This is the only time the API key will be shown
      message: 'Producer onboarded successfully. Please store your API key securely.',
    };

    return successResponse(response, 201, 'Producer registered successfully');
  } catch (error: any) {
    console.error('Error in producer onboarding:', error);

    // Check for unique constraint violation
    if (error.code === '23505') {
      if (error.constraint?.includes('name')) {
        return ErrorResponses.conflict('A producer with this name already exists');
      }
      if (error.constraint?.includes('email')) {
        return ErrorResponses.conflict('A producer with this email already exists');
      }
    }

    return ErrorResponses.internalServerError(
      process.env.NODE_ENV === 'development' ? error.message : 'Failed to onboard producer'
    );
  }
}

/**
 * Validate producer onboarding request
 */
function validateProducerOnboarding(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate name
  if (!data.name || typeof data.name !== 'string') {
    errors.push('name is required and must be a string');
  } else if (data.name.length < 3) {
    errors.push('name must be at least 3 characters long');
  } else if (data.name.length > 255) {
    errors.push('name must not exceed 255 characters');
  }

  // Validate contact email
  if (!data.contactEmail || typeof data.contactEmail !== 'string') {
    errors.push('contactEmail is required and must be a string');
  } else if (!isValidEmail(data.contactEmail)) {
    errors.push('contactEmail must be a valid email address');
  }

  // Validate optional fields
  if (data.description !== undefined && typeof data.description !== 'string') {
    errors.push('description must be a string');
  }

  if (data.contactName !== undefined && typeof data.contactName !== 'string') {
    errors.push('contactName must be a string');
  }

  if (data.department !== undefined && typeof data.department !== 'string') {
    errors.push('department must be a string');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}