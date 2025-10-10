# Webhook Event Publisher SDKs

This directory contains SDKs for publishing events to the Webhook Management System in various programming languages.

## Available SDKs

### Java Spring Boot SDK (✅ Production Ready)

**Location:** `java-spring-boot-sdk/`

**Language:** Java 21
**Framework:** Spring Boot 3.2+
**Publishing Modes:** Synchronous & Asynchronous

A production-ready SDK for Java/Spring Boot applications with support for both blocking (sync) and non-blocking (async) event publishing.

**Key Features:**
- ✅ **Sync & Async Publishing** - Choose based on your use case
- ✅ **Spring Boot Auto-Configuration** - Zero-config setup
- ✅ **Retry Logic** - Built-in exponential backoff
- ✅ **Batch Publishing** - Publish multiple events in parallel
- ✅ **Type-Safe** - Full Java type safety with validation
- ✅ **Production-Ready** - Comprehensive error handling

**Quick Start:**
```xml
<dependency>
    <groupId>com.webhook</groupId>
    <artifactId>webhook-event-publisher-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

```yaml
webhook:
  sdk:
    base-url: http://localhost:3005
    api-key: your-api-key
```

```java
@Autowired
private WebhookEventPublisherClient webhookClient;

// Sync publishing
EventPublishResponse response = webhookClient.publishEvent(request);

// Async publishing
CompletableFuture<EventPublishResponse> future =
    webhookClient.publishEventAsync(request);
```

**Documentation:** See [java-spring-boot-sdk/README.md](java-spring-boot-sdk/README.md)
**Example App:** See [java-spring-boot-sdk/example/](java-spring-boot-sdk/example/)

---

## Coming Soon

### Python SDK (Planned)
- **Framework:** Django/Flask compatible
- **Publishing:** Sync with optional async (asyncio)
- **Target:** Python 3.11+

### Node.js SDK (Planned)
- **Framework:** Express/NestJS compatible
- **Publishing:** Promise-based with async/await
- **Target:** Node.js 18+

### .NET SDK (Planned)
- **Framework:** .NET 8+
- **Publishing:** Sync & async with Task<T>
- **Target:** C# 12+

### Go SDK (Planned)
- **Publishing:** Goroutine-based async
- **Target:** Go 1.21+

---

## SDK Comparison Matrix

| Feature | Java Spring Boot | Python | Node.js | .NET | Go |
|---------|-----------------|--------|---------|------|-----|
| **Status** | ✅ Ready | 🚧 Planned | 🚧 Planned | 🚧 Planned | 🚧 Planned |
| **Sync Publishing** | ✅ | 🚧 | 🚧 | 🚧 | 🚧 |
| **Async Publishing** | ✅ | 🚧 | 🚧 | 🚧 | 🚧 |
| **Batch Publishing** | ✅ | 🚧 | 🚧 | 🚧 | 🚧 |
| **Retry Logic** | ✅ | 🚧 | 🚧 | 🚧 | 🚧 |
| **Auto-Config** | ✅ Spring Boot | 🚧 | 🚧 | 🚧 | 🚧 |
| **Type Safety** | ✅ Strong | 🚧 | 🚧 | 🚧 | 🚧 |
| **Example App** | ✅ Included | 🚧 | 🚧 | 🚧 | 🚧 |

---

## When to Use Each Publishing Mode

### Synchronous (Blocking)

**Use When:**
- Event publishing is critical to business logic
- You need immediate confirmation of success/failure
- Transaction integrity depends on event delivery
- Order processing, payment confirmations, critical state changes

**Example:**
```java
// Order creation - MUST wait for event confirmation
EventPublishResponse response = webhookClient.publishEvent(orderCreatedEvent);
if (!response.isSuccess()) {
    rollbackOrder(); // Rollback if event fails
}
```

### Asynchronous (Non-Blocking)

**Use When:**
- Event publishing is non-critical (analytics, notifications)
- Application performance is more important than immediate confirmation
- Fire-and-forget scenarios
- User activity tracking, audit logs, metrics

**Example:**
```java
// User login tracking - fire and forget
webhookClient.publishEventAsync(userLoginEvent)
    .thenAccept(response -> log.info("Event published: " + response.getEventId()))
    .exceptionally(ex -> {
        log.warn("Event failed (non-critical): " + ex.getMessage());
        return null;
    });
// Continue processing immediately
```

---

## General Architecture

All SDKs follow this general flow:

```
Application Code
      ↓
   SDK Client
      ↓
HTTP Client (RestTemplate/Axios/HttpClient)
      ↓
POST /api/v1/events/publish
      ↓
Event Publisher Lambda
      ↓
Kafka Topic
      ↓
Kafka Consumer Worker (Real-time)
      ↓
Webhook Delivery → Subscribers
      ↓ (on failure)
Retry Queue → Polling Worker
```

---

## SDK Development Guidelines

If you're developing a new SDK, please follow these conventions:

### Required Features

1. **Sync Publishing** - Blocking call that waits for response
2. **Async Publishing** - Non-blocking call with callbacks/promises/futures
3. **Batch Publishing** - Publish multiple events in parallel
4. **Retry Logic** - Exponential backoff with configurable max retries
5. **Error Handling** - Specific exception types for different failures
6. **Validation** - Input validation before API calls
7. **Logging** - Configurable logging for debugging
8. **Configuration** - External configuration (env vars, config files)

### API Endpoint

All SDKs should call:

```
POST /api/v1/events/publish
Headers:
  X-API-Key: {producer-api-key}
  Content-Type: application/json

Body:
{
  "eventType": "event.name",
  "schemaId": "schema-id",
  "payload": { ... }
}
```

### Response Format

```json
{
  "success": true,
  "event": {
    "eventId": "uuid",
    "publishedAt": "2025-10-09T21:00:00Z",
    "subscriberCount": 5
  }
}
```

### Configuration Properties

All SDKs should support these configuration options:

- `base-url` / `WEBHOOK_API_URL` - API base URL
- `api-key` / `WEBHOOK_API_KEY` - Producer API key
- `connect-timeout` - Connection timeout (ms)
- `read-timeout` - Read timeout (ms)
- `max-retries` - Maximum retry attempts
- `async-enabled` - Enable/disable async publishing
- `logging-enabled` - Enable/disable logging

---

## Testing Your SDK

### 1. Unit Tests
Test request building, validation, error handling

### 2. Integration Tests
Test against local webhook API (http://localhost:3005)

### 3. Example Application
Provide a working example demonstrating all features

---

## Contributing

To contribute a new SDK:

1. Create a new directory: `sdk/{language}-sdk/`
2. Follow the SDK Development Guidelines above
3. Include comprehensive README with examples
4. Provide a working example application
5. Add unit and integration tests
6. Update this README with your SDK

---

## Support

For questions or issues:
- **SDK Issues:** Open an issue in this repository
- **API Issues:** Contact webhook system administrators
- **Examples:** See individual SDK example directories

---

## License

All SDKs are released under the MIT License.
