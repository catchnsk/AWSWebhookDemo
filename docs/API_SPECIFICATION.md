# Webhook Management System - API Specification

## Overview

This document provides detailed API specifications for the Webhook Management System. All APIs follow RESTful conventions and return JSON responses.

**Base URL**: `https://api.webhooks.example.com/api/v1`

**Authentication**: Bearer Token (JWT) or API Key

---

## Table of Contents

1. [Authentication](#authentication)
2. [Common Response Formats](#common-response-formats)
3. [Webhook Management APIs](#webhook-management-apis)
4. [Schema Management APIs](#schema-management-apis)
5. [Execution & Logging APIs](#execution--logging-apis)
6. [Analytics APIs](#analytics-apis)
7. [User Management APIs](#user-management-apis)
8. [Error Codes](#error-codes)
9. [Rate Limiting](#rate-limiting)
10. [Webhooks SDKs](#webhooks-sdks)

---

## Authentication

### Bearer Token (JWT)
```http
Authorization: Bearer <jwt_token>
```

### API Key
```http
X-API-Key: <api_key>
```

### Authentication Endpoints

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response** (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "developer"
  }
}
```

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

#### Generate API Key
```http
POST /auth/api-keys
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Production API Key",
  "expiresInDays": 90
}
```

**Response** (201 Created):
```json
{
  "apiKey": "wh_live_1234567890abcdef",
  "name": "Production API Key",
  "createdAt": "2025-09-30T10:00:00Z",
  "expiresAt": "2025-12-29T10:00:00Z"
}
```

---

## Common Response Formats

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "WEBHOOK_NOT_FOUND",
    "message": "Webhook with ID 'webhook-123' not found",
    "details": { /* optional additional details */ }
  }
}
```

### Pagination Format
```json
{
  "data": [ /* array of items */ ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

## Webhook Management APIs

### 1. Create Webhook

**Endpoint**: `POST /webhooks`

**Description**: Register a new webhook

**Request Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "Order Created Webhook",
  "url": "https://example.com/webhooks/order-created",
  "description": "Triggered when a new order is created",
  "eventType": "order.created",
  "schemaId": "schema-123",
  "authentication": {
    "type": "bearer",
    "token": "secret-bearer-token"
  },
  "retryPolicy": {
    "maxRetries": 3,
    "backoffStrategy": "exponential",
    "initialDelayMs": 1000
  },
  "timeoutMs": 30000,
  "headers": {
    "X-Custom-Header": "custom-value",
    "X-App-Version": "1.0.0"
  },
  "enabled": true,
  "tags": ["orders", "production"]
}
```

**Request Body Schema**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Webhook name (max 255 chars) |
| url | string | Yes | Target URL for webhook delivery |
| description | string | No | Webhook description |
| eventType | string | Yes | Type of event (e.g., "order.created") |
| schemaId | string | No | UUID of JSON schema for validation |
| authentication | object | No | Authentication configuration |
| authentication.type | string | No | Auth type: "bearer", "api_key", "oauth2", "basic", "none" |
| authentication.token | string | No | Auth token/key/password |
| authentication.username | string | No | Username (for basic auth) |
| retryPolicy | object | No | Retry configuration |
| retryPolicy.maxRetries | integer | No | Max retry attempts (0-10, default: 3) |
| retryPolicy.backoffStrategy | string | No | "exponential", "linear", "constant" (default: "exponential") |
| retryPolicy.initialDelayMs | integer | No | Initial delay in ms (default: 1000) |
| timeoutMs | integer | No | Request timeout in ms (default: 30000) |
| headers | object | No | Custom headers to include |
| enabled | boolean | No | Enable webhook immediately (default: true) |
| tags | array | No | Tags for organization |

**Response** (201 Created):
```json
{
  "id": "webhook-abc123",
  "name": "Order Created Webhook",
  "url": "https://example.com/webhooks/order-created",
  "description": "Triggered when a new order is created",
  "eventType": "order.created",
  "schemaId": "schema-123",
  "authentication": {
    "type": "bearer"
  },
  "retryPolicy": {
    "maxRetries": 3,
    "backoffStrategy": "exponential",
    "initialDelayMs": 1000
  },
  "timeoutMs": 30000,
  "headers": {
    "X-Custom-Header": "custom-value",
    "X-App-Version": "1.0.0"
  },
  "enabled": true,
  "status": "active",
  "tags": ["orders", "production"],
  "secret": "whsec_abc123xyz789",
  "createdAt": "2025-09-30T10:00:00Z",
  "updatedAt": "2025-09-30T10:00:00Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid request body
- `401 Unauthorized`: Missing or invalid authentication
- `409 Conflict`: Webhook with same name already exists
- `422 Unprocessable Entity`: Schema validation failed

---

### 2. List Webhooks

**Endpoint**: `GET /webhooks`

**Description**: Retrieve a paginated list of webhooks

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | Page number (default: 1) |
| limit | integer | No | Items per page (default: 20, max: 100) |
| search | string | No | Search by name or URL |
| status | string | No | Filter by status: "active", "paused", "failed" |
| enabled | boolean | No | Filter by enabled status |
| eventType | string | No | Filter by event type |
| tags | string | No | Filter by tags (comma-separated) |
| sortBy | string | No | Sort field: "name", "createdAt", "lastTriggeredAt" |
| sortOrder | string | No | "asc" or "desc" (default: "desc") |

**Example Request**:
```http
GET /webhooks?page=1&limit=20&status=active&tags=production&sortBy=lastTriggeredAt&sortOrder=desc
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "webhooks": [
    {
      "id": "webhook-abc123",
      "name": "Order Created Webhook",
      "url": "https://example.com/webhooks/order-created",
      "eventType": "order.created",
      "status": "active",
      "enabled": true,
      "tags": ["orders", "production"],
      "statistics": {
        "totalDeliveries": 1250,
        "successRate": 99.52,
        "avgLatencyMs": 245
      },
      "lastTriggeredAt": "2025-09-30T09:45:00Z",
      "createdAt": "2025-09-20T10:00:00Z"
    },
    {
      "id": "webhook-def456",
      "name": "User Signup Webhook",
      "url": "https://example.com/webhooks/user-signup",
      "eventType": "user.created",
      "status": "active",
      "enabled": true,
      "tags": ["users", "production"],
      "statistics": {
        "totalDeliveries": 850,
        "successRate": 100.0,
        "avgLatencyMs": 180
      },
      "lastTriggeredAt": "2025-09-30T09:30:00Z",
      "createdAt": "2025-09-15T08:00:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

### 3. Get Webhook Details

**Endpoint**: `GET /webhooks/{webhookId}`

**Description**: Retrieve detailed information about a specific webhook

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| webhookId | string | Yes | Webhook UUID |

**Example Request**:
```http
GET /webhooks/webhook-abc123
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "id": "webhook-abc123",
  "name": "Order Created Webhook",
  "url": "https://example.com/webhooks/order-created",
  "description": "Triggered when a new order is created",
  "eventType": "order.created",
  "schemaId": "schema-123",
  "authentication": {
    "type": "bearer"
  },
  "retryPolicy": {
    "maxRetries": 3,
    "backoffStrategy": "exponential",
    "initialDelayMs": 1000
  },
  "timeoutMs": 30000,
  "headers": {
    "X-Custom-Header": "custom-value"
  },
  "enabled": true,
  "status": "active",
  "tags": ["orders", "production"],
  "secret": "whsec_abc123xyz789",
  "statistics": {
    "totalDeliveries": 1250,
    "successfulDeliveries": 1244,
    "failedDeliveries": 6,
    "successRate": 99.52,
    "avgLatencyMs": 245,
    "p50LatencyMs": 210,
    "p95LatencyMs": 487,
    "p99LatencyMs": 892,
    "consecutiveFailures": 0
  },
  "lastTriggeredAt": "2025-09-30T09:45:00Z",
  "lastSuccessAt": "2025-09-30T09:45:00Z",
  "lastFailureAt": "2025-09-28T14:20:00Z",
  "createdAt": "2025-09-20T10:00:00Z",
  "updatedAt": "2025-09-30T08:30:00Z"
}
```

**Error Responses**:
- `404 Not Found`: Webhook not found

---

### 4. Update Webhook

**Endpoint**: `PUT /webhooks/{webhookId}`

**Description**: Update webhook configuration

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| webhookId | string | Yes | Webhook UUID |

**Request Body** (all fields optional):
```json
{
  "name": "Order Created Webhook - Updated",
  "url": "https://api.example.com/webhooks/order-created",
  "description": "Updated description",
  "enabled": true,
  "retryPolicy": {
    "maxRetries": 5,
    "backoffStrategy": "exponential",
    "initialDelayMs": 2000
  },
  "timeoutMs": 45000,
  "headers": {
    "X-Custom-Header": "new-value"
  },
  "tags": ["orders", "production", "v2"]
}
```

**Response** (200 OK):
```json
{
  "id": "webhook-abc123",
  "name": "Order Created Webhook - Updated",
  "url": "https://api.example.com/webhooks/order-created",
  "description": "Updated description",
  "enabled": true,
  "status": "active",
  "updatedAt": "2025-09-30T10:15:00Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid request body
- `404 Not Found`: Webhook not found
- `409 Conflict`: Name conflict with existing webhook

---

### 5. Delete Webhook

**Endpoint**: `DELETE /webhooks/{webhookId}`

**Description**: Soft delete a webhook (can be restored)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| webhookId | string | Yes | Webhook UUID |

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| permanent | boolean | No | Permanent delete (cannot be restored) |

**Example Request**:
```http
DELETE /webhooks/webhook-abc123?permanent=false
Authorization: Bearer <token>
```

**Response** (204 No Content)

**Error Responses**:
- `404 Not Found`: Webhook not found

---

### 6. Trigger Webhook

**Endpoint**: `POST /webhooks/{webhookId}/trigger`

**Description**: Manually trigger a webhook with a payload

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| webhookId | string | Yes | Webhook UUID |

**Request Body**:
```json
{
  "payload": {
    "orderId": "order-789",
    "customerId": "cust-456",
    "amount": 99.99,
    "status": "created",
    "timestamp": "2025-09-30T10:00:00Z"
  },
  "async": true
}
```

**Request Body Schema**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| payload | object | Yes | Webhook payload (must match schema if defined) |
| async | boolean | No | Async delivery (default: true) |

**Response** (202 Accepted) - For async delivery:
```json
{
  "executionId": "exec-xyz789",
  "webhookId": "webhook-abc123",
  "status": "queued",
  "message": "Webhook trigger queued for processing"
}
```

**Response** (200 OK) - For sync delivery:
```json
{
  "executionId": "exec-xyz789",
  "webhookId": "webhook-abc123",
  "status": "success",
  "statusCode": 200,
  "latencyMs": 245,
  "response": {
    "statusCode": 200,
    "body": "{\"success\": true}"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid payload
- `404 Not Found`: Webhook not found
- `422 Unprocessable Entity`: Payload validation failed against schema

---

### 7. Enable/Disable Webhook

**Endpoint**: `PATCH /webhooks/{webhookId}/status`

**Description**: Enable or disable a webhook

**Request Body**:
```json
{
  "enabled": false
}
```

**Response** (200 OK):
```json
{
  "id": "webhook-abc123",
  "enabled": false,
  "updatedAt": "2025-09-30T10:20:00Z"
}
```

---

### 8. Regenerate Webhook Secret

**Endpoint**: `POST /webhooks/{webhookId}/regenerate-secret`

**Description**: Regenerate the webhook signature secret

**Response** (200 OK):
```json
{
  "id": "webhook-abc123",
  "secret": "whsec_newSecret456xyz",
  "updatedAt": "2025-09-30T10:25:00Z"
}
```

---

### 9. Bulk Operations

**Endpoint**: `POST /webhooks/bulk`

**Description**: Perform bulk operations on multiple webhooks

**Request Body**:
```json
{
  "operation": "enable",
  "webhookIds": ["webhook-abc123", "webhook-def456", "webhook-ghi789"]
}
```

**Supported Operations**:
- `enable`: Enable webhooks
- `disable`: Disable webhooks
- `delete`: Delete webhooks
- `updateTags`: Add/remove tags

**Response** (200 OK):
```json
{
  "operation": "enable",
  "totalRequested": 3,
  "succeeded": 3,
  "failed": 0,
  "results": [
    {
      "webhookId": "webhook-abc123",
      "status": "success"
    },
    {
      "webhookId": "webhook-def456",
      "status": "success"
    },
    {
      "webhookId": "webhook-ghi789",
      "status": "success"
    }
  ]
}
```

---

## Schema Management APIs

### 1. Create Schema

**Endpoint**: `POST /schemas`

**Description**: Create a new JSON schema for webhook validation

**Request Body**:
```json
{
  "name": "Order Created Schema",
  "description": "Schema for order creation events",
  "version": "1.0.0",
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["orderId", "customerId", "amount"],
    "properties": {
      "orderId": { "type": "string" },
      "customerId": { "type": "string" },
      "amount": { "type": "number", "minimum": 0 },
      "status": {
        "type": "string",
        "enum": ["created", "pending", "completed", "cancelled"]
      },
      "timestamp": { "type": "string", "format": "date-time" }
    }
  },
  "isPublic": false
}
```

**Response** (201 Created):
```json
{
  "id": "schema-123",
  "name": "Order Created Schema",
  "description": "Schema for order creation events",
  "version": "1.0.0",
  "schema": { /* JSON schema object */ },
  "isPublic": false,
  "webhookCount": 0,
  "createdAt": "2025-09-30T10:00:00Z"
}
```

---

### 2. List Schemas

**Endpoint**: `GET /schemas`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | Page number (default: 1) |
| limit | integer | No | Items per page (default: 20) |
| search | string | No | Search by name |
| isPublic | boolean | No | Filter public schemas |

**Response** (200 OK):
```json
{
  "schemas": [
    {
      "id": "schema-123",
      "name": "Order Created Schema",
      "version": "1.0.0",
      "description": "Schema for order creation events",
      "webhookCount": 5,
      "isPublic": false,
      "createdAt": "2025-09-30T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 12,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 3. Get Schema Details

**Endpoint**: `GET /schemas/{schemaId}`

**Response** (200 OK):
```json
{
  "id": "schema-123",
  "name": "Order Created Schema",
  "description": "Schema for order creation events",
  "version": "1.0.0",
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["orderId", "customerId", "amount"],
    "properties": { /* ... */ }
  },
  "webhookCount": 5,
  "isPublic": false,
  "createdAt": "2025-09-30T10:00:00Z",
  "updatedAt": "2025-09-30T10:00:00Z"
}
```

---

### 4. Update Schema

**Endpoint**: `PUT /schemas/{schemaId}`

**Note**: Updating a schema creates a new version. Existing webhooks continue using the old version.

**Request Body**:
```json
{
  "description": "Updated description",
  "schema": { /* updated schema */ },
  "version": "1.1.0"
}
```

**Response** (200 OK):
```json
{
  "id": "schema-456",
  "name": "Order Created Schema",
  "version": "1.1.0",
  "previousVersionId": "schema-123",
  "updatedAt": "2025-09-30T11:00:00Z"
}
```

---

### 5. Validate Payload

**Endpoint**: `POST /schemas/{schemaId}/validate`

**Description**: Test a payload against a schema

**Request Body**:
```json
{
  "payload": {
    "orderId": "order-789",
    "customerId": "cust-456",
    "amount": 99.99,
    "status": "created"
  }
}
```

**Response** (200 OK) - Valid:
```json
{
  "valid": true,
  "errors": []
}
```

**Response** (400 Bad Request) - Invalid:
```json
{
  "valid": false,
  "errors": [
    {
      "path": "/timestamp",
      "message": "Required property 'timestamp' is missing"
    },
    {
      "path": "/amount",
      "message": "Value must be greater than or equal to 0"
    }
  ]
}
```

---

### 6. Delete Schema

**Endpoint**: `DELETE /schemas/{schemaId}`

**Note**: Cannot delete schemas currently in use by webhooks

**Response** (204 No Content)

**Error Responses**:
- `409 Conflict`: Schema is in use by active webhooks

---

## Execution & Logging APIs

### 1. Get Webhook Execution Logs

**Endpoint**: `GET /webhooks/{webhookId}/logs`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | Page number (default: 1) |
| limit | integer | No | Items per page (default: 50, max: 200) |
| status | string | No | Filter by status: "success", "failed", "retrying" |
| from | string | No | Start date (ISO 8601 format) |
| to | string | No | End date (ISO 8601 format) |

**Example Request**:
```http
GET /webhooks/webhook-abc123/logs?page=1&limit=50&status=failed&from=2025-09-29T00:00:00Z&to=2025-09-30T23:59:59Z
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "logs": [
    {
      "executionId": "exec-xyz789",
      "webhookId": "webhook-abc123",
      "status": "failed",
      "retryAttempt": 2,
      "request": {
        "url": "https://example.com/webhooks/order-created",
        "method": "POST",
        "headers": {
          "Content-Type": "application/json",
          "X-Webhook-Signature": "sha256=abc123..."
        },
        "payload": {
          "orderId": "order-789",
          "customerId": "cust-456",
          "amount": 99.99
        }
      },
      "response": {
        "statusCode": 500,
        "headers": {
          "Content-Type": "text/plain"
        },
        "body": "Internal Server Error"
      },
      "latencyMs": 1250,
      "error": "Connection timeout",
      "errorCode": "TIMEOUT",
      "queuedAt": "2025-09-30T09:45:00Z",
      "startedAt": "2025-09-30T09:45:01Z",
      "completedAt": "2025-09-30T09:45:02.250Z",
      "nextRetryAt": "2025-09-30T09:47:00Z"
    }
  ],
  "pagination": {
    "total": 125,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

---

### 2. Get Single Execution Details

**Endpoint**: `GET /executions/{executionId}`

**Response** (200 OK):
```json
{
  "executionId": "exec-xyz789",
  "webhookId": "webhook-abc123",
  "webhookName": "Order Created Webhook",
  "status": "success",
  "retryAttempt": 0,
  "request": {
    "url": "https://example.com/webhooks/order-created",
    "method": "POST",
    "headers": { /* request headers */ },
    "payload": { /* webhook payload */ }
  },
  "response": {
    "statusCode": 200,
    "headers": { /* response headers */ },
    "body": "{\"success\": true, \"orderId\": \"order-789\"}"
  },
  "latencyMs": 245,
  "queuedAt": "2025-09-30T09:45:00Z",
  "startedAt": "2025-09-30T09:45:01Z",
  "completedAt": "2025-09-30T09:45:01.245Z"
}
```

---

### 3. Retry Failed Execution

**Endpoint**: `POST /executions/{executionId}/retry`

**Description**: Manually retry a failed execution

**Response** (202 Accepted):
```json
{
  "executionId": "exec-xyz789",
  "status": "queued",
  "message": "Execution queued for retry"
}
```

---

### 4. Get All Execution Logs

**Endpoint**: `GET /executions`

**Description**: Get execution logs across all webhooks

**Query Parameters**: Same as webhook-specific logs plus:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| webhookId | string | No | Filter by specific webhook |

**Response**: Same format as webhook-specific logs

---

### 5. Export Logs

**Endpoint**: `POST /executions/export`

**Description**: Export execution logs to CSV/JSON

**Request Body**:
```json
{
  "webhookId": "webhook-abc123",
  "from": "2025-09-01T00:00:00Z",
  "to": "2025-09-30T23:59:59Z",
  "status": "failed",
  "format": "csv"
}
```

**Response** (202 Accepted):
```json
{
  "exportId": "export-123",
  "status": "processing",
  "message": "Export job started. You will receive an email when complete."
}
```

---

## Analytics APIs

### 1. Get Dashboard Metrics

**Endpoint**: `GET /analytics/dashboard`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| from | string | No | Start date (default: 7 days ago) |
| to | string | No | End date (default: now) |

**Example Request**:
```http
GET /analytics/dashboard?from=2025-09-23T00:00:00Z&to=2025-09-30T23:59:59Z
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "summary": {
    "totalWebhooks": 45,
    "activeWebhooks": 42,
    "pausedWebhooks": 3,
    "failedWebhooks": 0,
    "totalDeliveries": 125840,
    "successfulDeliveries": 125234,
    "failedDeliveries": 606,
    "successRate": 99.52,
    "avgLatencyMs": 312,
    "p50LatencyMs": 245,
    "p95LatencyMs": 487,
    "p99LatencyMs": 892
  },
  "deliveriesOverTime": [
    {
      "timestamp": "2025-09-30T00:00:00Z",
      "totalDeliveries": 18450,
      "successfulDeliveries": 18398,
      "failedDeliveries": 52
    },
    {
      "timestamp": "2025-09-30T01:00:00Z",
      "totalDeliveries": 15230,
      "successfulDeliveries": 15201,
      "failedDeliveries": 29
    }
  ],
  "topWebhooks": [
    {
      "webhookId": "webhook-abc123",
      "name": "Order Created Webhook",
      "deliveries": 35000,
      "successRate": 99.8
    }
  ],
  "recentFailures": [
    {
      "webhookId": "webhook-def456",
      "name": "Payment Failed Webhook",
      "failureCount": 15,
      "lastFailureAt": "2025-09-30T09:45:00Z"
    }
  ]
}
```

---

### 2. Get Webhook-Specific Analytics

**Endpoint**: `GET /analytics/webhooks/{webhookId}`

**Query Parameters**: Same as dashboard metrics

**Response** (200 OK):
```json
{
  "webhookId": "webhook-abc123",
  "name": "Order Created Webhook",
  "period": {
    "from": "2025-09-23T00:00:00Z",
    "to": "2025-09-30T23:59:59Z"
  },
  "metrics": {
    "totalDeliveries": 35000,
    "successfulDeliveries": 34930,
    "failedDeliveries": 70,
    "successRate": 99.8,
    "avgLatencyMs": 245,
    "p50LatencyMs": 210,
    "p95LatencyMs": 450,
    "p99LatencyMs": 780
  },
  "deliveriesOverTime": [ /* hourly/daily breakdown */ ],
  "statusCodeDistribution": {
    "200": 34800,
    "201": 130,
    "500": 50,
    "timeout": 20
  },
  "retryAnalysis": {
    "retriesNeeded": 85,
    "successAfterRetry": 15,
    "failedAfterAllRetries": 70
  }
}
```

---

### 3. Get Dead Letter Queue

**Endpoint**: `GET /analytics/dead-letter-queue`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| webhookId | string | No | Filter by webhook |
| investigated | boolean | No | Filter by investigation status |
| page | integer | No | Page number |
| limit | integer | No | Items per page |

**Response** (200 OK):
```json
{
  "items": [
    {
      "id": "dlq-123",
      "webhookId": "webhook-abc123",
      "webhookName": "Order Created Webhook",
      "executionId": "exec-xyz789",
      "requestPayload": { /* original payload */ },
      "finalErrorMessage": "Connection timeout after 3 retries",
      "totalAttempts": 4,
      "investigated": false,
      "assignedTo": null,
      "createdAt": "2025-09-30T09:50:00Z"
    }
  ],
  "pagination": { /* ... */ }
}
```

---

### 4. Mark DLQ Item as Investigated

**Endpoint**: `PATCH /analytics/dead-letter-queue/{dlqId}`

**Request Body**:
```json
{
  "investigated": true,
  "resolutionNotes": "Fixed by updating webhook URL and retrying manually"
}
```

**Response** (200 OK):
```json
{
  "id": "dlq-123",
  "investigated": true,
  "resolutionNotes": "Fixed by updating webhook URL and retrying manually",
  "resolvedAt": "2025-09-30T10:30:00Z"
}
```

---

## User Management APIs

### 1. Get Current User

**Endpoint**: `GET /users/me`

**Response** (200 OK):
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "developer",
  "createdAt": "2025-08-01T10:00:00Z",
  "lastLoginAt": "2025-09-30T09:00:00Z"
}
```

---

### 2. Update User Profile

**Endpoint**: `PUT /users/me`

**Request Body**:
```json
{
  "name": "John Updated Doe"
}
```

**Response** (200 OK):
```json
{
  "id": "user-123",
  "name": "John Updated Doe",
  "updatedAt": "2025-09-30T10:35:00Z"
}
```

---

### 3. List API Keys

**Endpoint**: `GET /users/me/api-keys`

**Response** (200 OK):
```json
{
  "apiKeys": [
    {
      "id": "key-123",
      "name": "Production API Key",
      "keyPrefix": "wh_live_1234",
      "createdAt": "2025-09-01T10:00:00Z",
      "expiresAt": "2025-12-01T10:00:00Z",
      "lastUsedAt": "2025-09-30T09:30:00Z"
    }
  ]
}
```

---

### 4. Revoke API Key

**Endpoint**: `DELETE /users/me/api-keys/{keyId}`

**Response** (204 No Content)

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (duplicate name, etc.) |
| `SCHEMA_VALIDATION_FAILED` | 422 | Payload doesn't match schema |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

---

## Rate Limiting

**Default Limits**:
- 1000 requests per minute per user
- 100 webhook triggers per minute per webhook
- 10 bulk operations per minute

**Rate Limit Headers**:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1696068000
```

**Rate Limit Exceeded Response** (429):
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please retry after 60 seconds.",
    "retryAfter": 60
  }
}
```

---

## Webhooks SDKs

### Node.js Example

```javascript
const WebhookClient = require('@webhooks/sdk');

const client = new WebhookClient({
  apiKey: 'wh_live_1234567890abcdef',
  baseUrl: 'https://api.webhooks.example.com/api/v1'
});

// Create webhook
const webhook = await client.webhooks.create({
  name: 'Order Created',
  url: 'https://example.com/webhooks/order-created',
  eventType: 'order.created',
  schemaId: 'schema-123'
});

// Trigger webhook
await client.webhooks.trigger(webhook.id, {
  orderId: 'order-789',
  amount: 99.99
});

// List webhooks
const { webhooks } = await client.webhooks.list({
  status: 'active',
  limit: 20
});
```

### Python Example

```python
from webhooks_sdk import WebhookClient

client = WebhookClient(
    api_key='wh_live_1234567890abcdef',
    base_url='https://api.webhooks.example.com/api/v1'
)

# Create webhook
webhook = client.webhooks.create(
    name='Order Created',
    url='https://example.com/webhooks/order-created',
    event_type='order.created',
    schema_id='schema-123'
)

# Trigger webhook
client.webhooks.trigger(webhook['id'], {
    'orderId': 'order-789',
    'amount': 99.99
})
```

---

## Webhook Signature Verification

When receiving webhooks, verify the signature to ensure authenticity:

### Signature Header
```
X-Webhook-Signature: t=1696068000,v1=abc123def456...
```

### Verification Algorithm

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const [timestamp, signatureHash] = signature.split(',').map(s => s.split('=')[1]);

  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signatureHash),
    Buffer.from(expectedHash)
  );
}

// Usage
const isValid = verifyWebhookSignature(
  req.body,
  req.headers['x-webhook-signature'],
  'whsec_abc123xyz789'
);

if (!isValid) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

---

## Changelog

### v1.0.0 (2025-09-30)
- Initial API release
- Webhook CRUD operations
- Schema management
- Execution logging
- Analytics endpoints
- User management

---

**Document Version**: 1.0
**Last Updated**: 2025-09-30