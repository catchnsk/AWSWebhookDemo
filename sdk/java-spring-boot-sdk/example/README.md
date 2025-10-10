# Webhook Event Publisher SDK - Example Application

This is a comprehensive example Spring Boot application demonstrating the usage of the Webhook Event Publisher SDK. The application showcases best practices for publishing webhook events in production environments.

## Overview

This example demonstrates:

- **Synchronous Event Publishing** - For critical operations that require immediate confirmation (order processing)
- **Asynchronous Event Publishing** - For non-critical operations that should not block the main flow (user events)
- **Batch Event Publishing** - For bulk operations and periodic sync tasks
- **Error Handling & Retry Logic** - Production-ready error handling patterns
- **Different Event Types** - Multiple event types with realistic payloads

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Example Application                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │ OrderService │         │ UserService  │                 │
│  │   (Sync)     │         │   (Async)    │                 │
│  └──────┬───────┘         └──────┬───────┘                 │
│         │                        │                          │
│         └────────────┬───────────┘                          │
│                      │                                      │
│         ┌────────────▼────────────┐                        │
│         │ WebhookEventPublisher   │                        │
│         │        Client            │                        │
│         └────────────┬────────────┘                        │
│                      │                                      │
└──────────────────────┼──────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │  Webhook Management     │
         │       System API        │
         └─────────────────────────┘
```

## Prerequisites

- Java 21 or higher
- Maven 3.6 or higher
- Webhook Management System running (default: http://localhost:3005)
- Valid API key for the Webhook Management System

## Configuration

### 1. Install the SDK

First, install the Webhook Event Publisher SDK to your local Maven repository:

```bash
cd ../
mvn clean install
cd example/
```

### 2. Configure the Application

The application can be configured via `application.yml` or environment variables.

#### Option A: Environment Variables (Recommended)

```bash
export WEBHOOK_API_URL=http://localhost:3005
export WEBHOOK_API_KEY=your-api-key-here
export WEBHOOK_PRODUCER_ID=example-app-producer
```

#### Option B: application.yml

Edit `src/main/resources/application.yml`:

```yaml
webhook:
  sdk:
    base-url: http://localhost:3005
    api-key: your-api-key-here
    producer-id: example-app-producer
```

### Configuration Properties

| Property | Default | Description |
|----------|---------|-------------|
| `webhook.sdk.base-url` | `http://localhost:3005` | Webhook API base URL |
| `webhook.sdk.api-key` | - | Producer API key (required) |
| `webhook.sdk.producer-id` | `example-app-producer` | Producer identifier |
| `webhook.sdk.connect-timeout` | `5000` | Connection timeout (ms) |
| `webhook.sdk.read-timeout` | `30000` | Read timeout (ms) |
| `webhook.sdk.max-retries` | `3` | Max retry attempts |
| `webhook.sdk.async-enabled` | `true` | Enable async publishing |
| `webhook.sdk.async-thread-pool-size` | `10` | Async thread pool size |
| `webhook.sdk.logging-enabled` | `true` | Enable request logging |

## Running the Application

### Using Maven

```bash
mvn spring-boot:run
```

### Using Java

```bash
mvn clean package
java -jar target/webhook-sdk-example-1.0.0.jar
```

The application will start on `http://localhost:8080/api`

## API Endpoints

### Order Management (Synchronous Publishing)

#### Create Order

```bash
curl -X POST http://localhost:8080/api/demo/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerEmail": "john.doe@example.com",
    "customerName": "John Doe",
    "items": [
      {
        "productName": "Laptop",
        "quantity": 1,
        "unitPrice": 999.99
      }
    ]
  }'
```

#### Update Order Status

```bash
curl -X POST http://localhost:8080/api/demo/orders/{orderId}/status \
  -H "Content-Type: application/json" \
  -d '{
    "newStatus": "SHIPPED"
  }'
```

#### Cancel Order

```bash
curl -X POST http://localhost:8080/api/demo/orders/{orderId}/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer requested cancellation"
  }'
```

#### List All Orders

```bash
curl http://localhost:8080/api/demo/orders
```

### User Management (Asynchronous Publishing)

#### Create User

```bash
curl -X POST http://localhost:8080/api/demo/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane.smith@example.com",
    "username": "janesmith",
    "firstName": "Jane",
    "lastName": "Smith"
  }'
```

#### Update User Profile

```bash
curl -X PUT http://localhost:8080/api/demo/users/{userId} \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Janet",
    "phoneNumber": "+1-555-0123"
  }'
```

#### Record User Login

```bash
curl -X POST http://localhost:8080/api/demo/users/{userId}/login \
  -H "Content-Type: application/json" \
  -d '{
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0..."
  }'
```

#### Deactivate User

```bash
curl -X POST http://localhost:8080/api/demo/users/{userId}/deactivate \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Account inactive for 90 days"
  }'
```

#### List All Users

```bash
curl http://localhost:8080/api/demo/users
```

### Batch Operations

#### Batch Publish Events

```bash
curl -X POST http://localhost:8080/api/demo/batch \
  -H "Content-Type: application/json" \
  -d '{
    "count": 10
  }'
```

### Utility Endpoints

#### Health Check

```bash
curl http://localhost:8080/api/demo/health
```

#### Generate Sample Data

```bash
curl -X POST http://localhost:8080/api/demo/sample-data
```

## Event Types

### Order Events (Synchronous)

1. **order.created**
   - Schema: `order-schema-v1`
   - Published when: New order is created
   - Publishing mode: Synchronous with retry

2. **order.status_changed**
   - Schema: `order-status-schema-v1`
   - Published when: Order status is updated
   - Publishing mode: Synchronous

3. **order.cancelled**
   - Schema: `order-cancelled-schema-v1`
   - Published when: Order is cancelled
   - Publishing mode: Synchronous with retry

### User Events (Asynchronous)

1. **user.created**
   - Schema: `user-schema-v1`
   - Published when: New user is created
   - Publishing mode: Asynchronous (fire-and-forget)

2. **user.profile_updated**
   - Schema: `user-profile-schema-v1`
   - Published when: User profile is updated
   - Publishing mode: Asynchronous

3. **user.logged_in**
   - Schema: `user-login-schema-v1`
   - Published when: User logs in
   - Publishing mode: Asynchronous

4. **user.deactivated**
   - Schema: `user-deactivated-schema-v1`
   - Published when: User account is deactivated
   - Publishing mode: Asynchronous

## Code Examples

### Synchronous Publishing (OrderService)

```java
@Service
public class OrderService {
    private final WebhookEventPublisherClient webhookClient;

    public Order createOrder(Order order) {
        // Prepare event request
        EventPublishRequest eventRequest = EventPublishRequest.builder()
            .eventType("order.created")
            .schemaId("order-schema-v1")
            .payload(buildOrderPayload(order))
            .build();

        // Publish synchronously with retry
        EventPublishResponse response = webhookClient.publishEventWithRetry(eventRequest, 3);

        // Save order only after successful event publication
        orderStorage.put(order.getOrderId(), order);

        return order;
    }
}
```

### Asynchronous Publishing (UserService)

```java
@Service
public class UserService {
    private final WebhookEventPublisherClient webhookClient;

    public User createUser(User user) {
        // Save user immediately
        userStorage.put(user.getUserId(), user);

        // Publish event asynchronously (fire-and-forget)
        EventPublishRequest eventRequest = EventPublishRequest.builder()
            .eventType("user.created")
            .schemaId("user-schema-v1")
            .payload(buildUserPayload(user))
            .build();

        webhookClient.publishEventAsync(eventRequest)
            .thenAccept(response ->
                log.info("Event published: {}", response.getEventId()))
            .exceptionally(ex -> {
                log.error("Failed to publish event: {}", ex.getMessage());
                return null;
            });

        return user;
    }
}
```

### Batch Publishing

```java
public CompletableFuture<EventPublishResponse[]> publishBatchEvents(List<User> users) {
    EventPublishRequest[] requests = users.stream()
        .map(this::createEventRequest)
        .toArray(EventPublishRequest[]::new);

    return webhookClient.publishEventsAsync(requests)
        .thenApply(responses -> {
            log.info("Published {} events", responses.length);
            return responses;
        });
}
```

## Best Practices Demonstrated

### 1. Synchronous vs Asynchronous Publishing

**Use Synchronous Publishing When:**
- The operation is business-critical (e.g., order creation, payment processing)
- You need immediate confirmation that the event was published
- Failure to publish the event should prevent the operation from completing
- Data consistency between your system and subscribers is critical

**Use Asynchronous Publishing When:**
- The operation is not critical to the main business flow
- You want to improve performance and user experience
- Event publishing failures should not block the operation
- You can tolerate eventual consistency

### 2. Error Handling

**Synchronous Error Handling:**
```java
try {
    EventPublishResponse response = webhookClient.publishEventWithRetry(request, 3);
    // Proceed with operation
} catch (Exception e) {
    // Roll back transaction
    // Log error
    // Return error to user
}
```

**Asynchronous Error Handling:**
```java
webhookClient.publishEventAsync(request)
    .thenAccept(response -> log.info("Success"))
    .exceptionally(ex -> {
        log.error("Failed: {}", ex.getMessage());
        // Queue for retry
        // Send alert
        return null;
    });
```

### 3. Retry Logic

The SDK provides built-in retry with exponential backoff:

```java
// Retry up to 3 times with exponential backoff (100ms, 200ms, 400ms)
EventPublishResponse response = webhookClient.publishEventWithRetry(request, 3);
```

### 4. Logging

Comprehensive logging at different levels:

```yaml
logging:
  level:
    com.webhook.sdk: DEBUG
    com.webhook.sdk.example: DEBUG
```

## Monitoring & Health Checks

The application includes Spring Boot Actuator endpoints:

- Health: `http://localhost:8080/api/actuator/health`
- Metrics: `http://localhost:8080/api/actuator/metrics`
- Info: `http://localhost:8080/api/actuator/info`

## Troubleshooting

### Connection Refused

**Problem:** Cannot connect to Webhook Management System

**Solution:**
- Verify the Webhook Management System is running
- Check the `webhook.sdk.base-url` configuration
- Ensure firewall/network allows the connection

### Authentication Failed

**Problem:** 401 Unauthorized errors

**Solution:**
- Verify your API key is correct
- Check that the API key has proper permissions
- Ensure the producer is registered in the Webhook Management System

### Timeout Errors

**Problem:** Requests timing out

**Solution:**
- Increase `webhook.sdk.read-timeout` value
- Check network latency
- Verify the Webhook Management System is responsive

### Events Not Publishing

**Problem:** Events not appearing in the system

**Solution:**
- Check application logs for errors
- Verify event types and schemas are registered
- Ensure payload matches the schema
- Check SDK logging is enabled

## Testing

Run the application and use the sample data generator:

```bash
# Start the application
mvn spring-boot:run

# Generate sample data
curl -X POST http://localhost:8080/api/demo/sample-data

# List created resources
curl http://localhost:8080/api/demo/orders
curl http://localhost:8080/api/demo/users
```

## Production Deployment

### Environment-Specific Configuration

Create environment-specific configuration files:

- `application-dev.yml` - Development environment
- `application-staging.yml` - Staging environment
- `application-prod.yml` - Production environment

Activate profile:

```bash
java -jar target/webhook-sdk-example-1.0.0.jar --spring.profiles.active=prod
```

### Security Best Practices

1. **Never commit API keys** - Use environment variables or secrets management
2. **Use HTTPS** - Always use secure connections in production
3. **Implement authentication** - Add authentication to your demo endpoints
4. **Rate limiting** - Implement rate limiting for API endpoints
5. **Monitoring** - Set up proper monitoring and alerting

### Performance Tuning

```yaml
webhook:
  sdk:
    async-thread-pool-size: 20  # Increase for high throughput
    connect-timeout: 3000        # Decrease for faster failures
    read-timeout: 10000          # Adjust based on expected response times
```

## Additional Resources

- [Webhook Event Publisher SDK Documentation](../README.md)
- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [API Reference](../docs/API.md)

## License

This example application is provided as-is for demonstration purposes.

## Support

For issues or questions:
- Create an issue in the repository
- Contact the SDK development team
- Check the main SDK documentation
