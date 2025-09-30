import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { generateWebhookSignature } from './crypto';

/**
 * Egress Gateway - HTTP client for webhook delivery
 */

export interface WebhookDeliveryConfig {
  url: string;
  payload: any;
  method?: 'POST' | 'PUT' | 'PATCH';
  secret?: string;
  headers?: Record<string, string>;
  timeout?: number;
  authType?: 'none' | 'bearer' | 'api_key' | 'basic' | 'hmac';
  authConfig?: {
    token?: string;
    username?: string;
    password?: string;
  };
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode: number;
  headers: Record<string, any>;
  body: string;
  latency: number;
  error?: string;
  errorCategory?: 'network' | 'timeout' | '4xx' | '5xx' | 'validation';
}

/**
 * Send webhook to target URL with retry logic
 */
export async function sendWebhook(
  config: WebhookDeliveryConfig
): Promise<WebhookDeliveryResult> {
  const startTime = Date.now();

  try {
    // Build request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'WebhookDeliverySystem/1.0',
      ...config.headers,
    };

    // Add webhook signature if secret provided
    if (config.secret) {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateWebhookSignature(config.payload, config.secret, timestamp);
      headers['X-Webhook-Signature'] = signature;
      headers['X-Webhook-Timestamp'] = timestamp.toString();
    }

    // Add authentication headers
    if (config.authType && config.authType !== 'none') {
      addAuthenticationHeaders(headers, config.authType, config.authConfig);
    }

    // Build axios config
    const axiosConfig: AxiosRequestConfig = {
      method: config.method || 'POST',
      url: config.url,
      data: config.payload,
      headers,
      timeout: config.timeout || 30000,
      validateStatus: () => true, // Don't throw on any status code
      maxRedirects: 3,
    };

    // Send request
    const response: AxiosResponse = await axios(axiosConfig);
    const latency = Date.now() - startTime;

    // Determine success (2xx status codes)
    const success = response.status >= 200 && response.status < 300;

    // Determine error category
    let errorCategory: WebhookDeliveryResult['errorCategory'] | undefined;
    let error: string | undefined;

    if (!success) {
      if (response.status >= 400 && response.status < 500) {
        errorCategory = '4xx';
        error = `Client error: ${response.status} ${response.statusText}`;
      } else if (response.status >= 500) {
        errorCategory = '5xx';
        error = `Server error: ${response.status} ${response.statusText}`;
      }
    }

    return {
      success,
      statusCode: response.status,
      headers: response.headers,
      body: formatResponseBody(response.data),
      latency,
      error,
      errorCategory,
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;

    // Categorize error
    let errorCategory: WebhookDeliveryResult['errorCategory'];
    let errorMessage: string;

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      errorCategory = 'timeout';
      errorMessage = `Request timeout after ${latency}ms`;
    } else if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'EAI_AGAIN'
    ) {
      errorCategory = 'network';
      errorMessage = `Network error: ${error.code} - ${error.message}`;
    } else if (error.response) {
      // Request was made and server responded with error status
      errorCategory = error.response.status >= 500 ? '5xx' : '4xx';
      errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
    } else {
      errorCategory = 'network';
      errorMessage = error.message || 'Unknown error';
    }

    return {
      success: false,
      statusCode: error.response?.status || 0,
      headers: error.response?.headers || {},
      body: formatResponseBody(error.response?.data),
      latency,
      error: errorMessage,
      errorCategory,
    };
  }
}

/**
 * Add authentication headers based on auth type
 */
function addAuthenticationHeaders(
  headers: Record<string, string>,
  authType: string,
  authConfig?: WebhookDeliveryConfig['authConfig']
): void {
  if (!authConfig) return;

  switch (authType) {
    case 'bearer':
      if (authConfig.token) {
        headers['Authorization'] = `Bearer ${authConfig.token}`;
      }
      break;

    case 'api_key':
      if (authConfig.token) {
        headers['X-API-Key'] = authConfig.token;
      }
      break;

    case 'basic':
      if (authConfig.username && authConfig.password) {
        const credentials = Buffer.from(
          `${authConfig.username}:${authConfig.password}`
        ).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }
      break;

    case 'hmac':
      // HMAC signature is handled separately via X-Webhook-Signature header
      break;
  }
}

/**
 * Format response body for storage
 */
function formatResponseBody(data: any): string {
  if (!data) return '';

  if (typeof data === 'string') {
    // Truncate very long strings
    return data.length > 5000 ? data.substring(0, 5000) + '... (truncated)' : data;
  }

  if (typeof data === 'object') {
    const jsonString = JSON.stringify(data);
    return jsonString.length > 5000
      ? jsonString.substring(0, 5000) + '... (truncated)'
      : jsonString;
  }

  return String(data);
}

/**
 * Calculate next retry delay based on backoff strategy
 */
export function calculateNextRetryDelay(
  retryAttempt: number,
  strategy: 'exponential' | 'linear' | 'constant',
  initialDelayMs: number = 1000
): number {
  switch (strategy) {
    case 'exponential':
      // 1s, 2s, 4s, 8s, 16s, ...
      return initialDelayMs * Math.pow(2, retryAttempt);

    case 'linear':
      // 1s, 2s, 3s, 4s, 5s, ...
      return initialDelayMs * (retryAttempt + 1);

    case 'constant':
      // 1s, 1s, 1s, 1s, ...
      return initialDelayMs;

    default:
      return initialDelayMs;
  }
}

/**
 * Calculate next retry timestamp
 */
export function calculateNextRetryAt(
  retryAttempt: number,
  strategy: 'exponential' | 'linear' | 'constant',
  initialDelayMs: number = 1000
): Date {
  const delayMs = calculateNextRetryDelay(retryAttempt, strategy, initialDelayMs);
  return new Date(Date.now() + delayMs);
}

/**
 * Check if error is retryable
 */
export function isRetryableError(errorCategory?: string, statusCode?: number): boolean {
  // Don't retry 4xx errors (client errors) except 408, 429
  if (errorCategory === '4xx') {
    return statusCode === 408 || statusCode === 429;
  }

  // Retry 5xx errors (server errors)
  if (errorCategory === '5xx') {
    return true;
  }

  // Retry network and timeout errors
  if (errorCategory === 'network' || errorCategory === 'timeout') {
    return true;
  }

  return false;
}

/**
 * Batch delivery for multiple webhooks
 */
export async function sendWebhookBatch(
  configs: WebhookDeliveryConfig[]
): Promise<WebhookDeliveryResult[]> {
  // Send all webhooks in parallel
  const promises = configs.map((config) => sendWebhook(config));

  return await Promise.all(promises);
}

/**
 * Test webhook connectivity
 */
export async function testWebhookConnection(url: string): Promise<{
  reachable: boolean;
  latency: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const response = await axios.head(url, {
      timeout: 5000,
      validateStatus: () => true,
    });

    const latency = Date.now() - startTime;

    return {
      reachable: response.status < 500,
      latency,
    };
  } catch (error: any) {
    return {
      reachable: false,
      latency: Date.now() - startTime,
      error: error.message,
    };
  }
}