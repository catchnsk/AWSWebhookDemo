# Webhook Event Publisher SDK - Java Spring Boot

A production-ready Java 21 Spring Boot SDK for publishing events to the Webhook Management System with support for both **synchronous** and **asynchronous** event publishing.

## Features

✅ **Sync & Async Publishing** - Choose between blocking and non-blocking operations
✅ **Spring Boot Auto-Configuration** - Zero configuration setup
✅ **Retry Logic** - Built-in exponential backoff retry mechanism
✅ **Batch Publishing** - Publish multiple events in parallel
✅ **Type-Safe** - Full Java type safety with validation
✅ **Production-Ready** - Comprehensive error handling and logging
✅ **Java 21** - Leverages latest Java features

## Requirements

- Java 21 or higher
- Spring Boot 3.2.0 or higher
- Maven 3.8+ or Gradle 8+

## Installation

### Maven

```xml
<dependency>
    <groupId>com.webhook</groupId>
    <artifactId>webhook-event-publisher-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

### Gradle

```gradle
implementation 'com.webhook:webhook-event-publisher-sdk:1.0.0'
```

## Configuration

Add the following properties to your `application.yml` or `application.properties`:

### application.yml

```yaml
webhook:
  sdk:
    base-url: http://localhost:3005  # Webhook API base URL
    api-key: your-producer-api-key    # Your producer API key
    producer-id: your-producer-id      # Optional: Your producer ID
    connect-timeout: 5000              # Connection timeout in ms (default: 5000)
    read-timeout: 30000                # Read timeout in ms (default: 30000)
    max-retries: 3                     # Max retry attempts (default: 3)
    async-enabled: true                # Enable async publishing (default: true)
    async-thread-pool-size: 10         # Async thread pool size (default: 10)
    logging-enabled: true              # Enable request logging (default: true)
```

### application.properties

```properties
webhook.sdk.base-url=http://localhost:3005
webhook.sdk.api-key=your-producer-api-key
webhook.sdk.producer-id=your-producer-id
webhook.sdk.connect-timeout=5000
webhook.sdk.read-timeout=30000
webhook.sdk.max-retries=3
webhook.sdk.async-enabled=true
webhook.sdk.async-thread-pool-size=10
webhook.sdk.logging-enabled=true
```

## Usage

### 1. Synchronous Event Publishing

Blocking call that waits for the response:

```java
import com.webhook.sdk.client.WebhookEventPublisherClient;
import com.webhook.sdk.model.EventPublishRequest;
import com.webhook.sdk.model.EventPublishResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class OrderService {

    @Autowired
    private WebhookEventPublisherClient webhookClient;

    public void createOrder(Order order) {
        // ... create order logic ...

        // Publish event synchronously
        EventPublishRequest request = EventPublishRequest.builder()
                .eventType("order.created")
                .schemaId("schema-id-here")
                .payload(Map.of(
                        "orderId", order.getId(),
                        "customerId", order.getCustomerId(),
                        "amount", order.getAmount(),
                        "status", "created"
                ))
                .build();

        try {
            EventPublishResponse response = webhookClient.publishEvent(request);
            System.out.println("Event published: " + response.getEventId());
        } catch (EventPublishException e) {
            System.err.println("Failed to publish event: " + e.getMessage());
        }
    }
}
```

### 2. Asynchronous Event Publishing

Non-blocking call that returns immediately with a `CompletableFuture`:

```java
import java.util.concurrent.CompletableFuture;

@Service
public class OrderService {

    @Autowired
    private WebhookEventPublisherClient webhookClient;

    public void createOrder(Order order) {
        // ... create order logic ...

        // Publish event asynchronously
        EventPublishRequest request = EventPublishRequest.builder()
                .eventType("order.created")
                .schemaId("schema-id-here")
                .payload(Map.of(
                        "orderId", order.getId(),
                        "customerId", order.getCustomerId(),
                        "amount", order.getAmount()
                ))
                .build();

        CompletableFuture<EventPublishResponse> future = webhookClient.publishEventAsync(request);

        // Handle response asynchronously
        future.thenAccept(response -> {
            System.out.println("Event published: " + response.getEventId());
        }).exceptionally(ex -> {
            System.err.println("Failed to publish event: " + ex.getMessage());
            return null;
        });

        // Continue processing without waiting for response
        System.out.println("Event publishing initiated, continuing...");
    }
}
```

### 3. Async/Await Pattern (Java 21)

Using virtual threads and structured concurrency:

```java
public CompletableFuture<Order> createOrderWithEvent(OrderDTO orderDTO) {
    return CompletableFuture.supplyAsync(() -> {
        // Create order
        Order order = orderRepository.save(new Order(orderDTO));

        // Publish event
        EventPublishRequest request = EventPublishRequest.builder()
                .eventType("order.created")
                .schemaId("order-schema-id")
                .payload(Map.of("orderId", order.getId()))
                .build();

        // Await event publishing
        EventPublishResponse response = webhookClient.publishEventAsync(request).join();

        System.out.println("Event ID: " + response.getEventId());

        return order;
    });
}
```

### 4. Batch Publishing (Parallel)

Publish multiple events in parallel:

```java
import java.util.List;
import java.util.concurrent.CompletableFuture;

public void publishMultipleEvents() {
    List<EventPublishRequest> events = List.of(
            EventPublishRequest.builder()
                    .eventType("user.created")
                    .schemaId("user-schema-id")
                    .payload(Map.of("userId", "user-1"))
                    .build(),
            EventPublishRequest.builder()
                    .eventType("order.created")
                    .schemaId("order-schema-id")
                    .payload(Map.of("orderId", "order-1"))
                    .build(),
            EventPublishRequest.builder()
                    .eventType("payment.processed")
                    .schemaId("payment-schema-id")
                    .payload(Map.of("paymentId", "payment-1"))
                    .build()
    );

    // Publish all events in parallel
    CompletableFuture<List<EventPublishResponse>> future =
            webhookClient.publishEventsAsync(events);

    // Wait for all events to be published
    future.thenAccept(responses -> {
        System.out.println("Published " + responses.size() + " events");
        responses.forEach(r -> System.out.println("Event ID: " + r.getEventId()));
    });
}
```

### 5. Retry with Custom Logic

```java
public void publishWithRetry() {
    EventPublishRequest request = EventPublishRequest.builder()
            .eventType("critical.event")
            .schemaId("critical-schema-id")
            .payload(Map.of("data", "important"))
            .build();

    try {
        // Synchronous publish with automatic retry (up to 3 attempts)
        EventPublishResponse response = webhookClient.publishEventWithRetry(request);
        System.out.println("Event published after retries: " + response.getEventId());
    } catch (EventPublishException e) {
        System.err.println("Failed after all retries: " + e.getMessage());
        // Fallback logic here
    }
}
```

## Advanced Configuration

### Custom RestTemplate/WebClient

You can override the default beans to customize HTTP client behavior:

```java
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;

@Configuration
public class WebhookClientConfig {

    @Bean
    public RestTemplate webhookRestTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(10))
                .setReadTimeout(Duration.ofSeconds(60))
                .build();
    }

    @Bean
    public WebClient webhookWebClient(WebClient.Builder builder) {
        return builder
                .defaultHeader("X-Custom-Header", "value")
                .build();
    }
}
```

## Error Handling

The SDK provides specific exceptions for different error scenarios:

```java
import com.webhook.sdk.exception.EventPublishException;
import com.webhook.sdk.exception.InvalidConfigurationException;
import com.webhook.sdk.exception.WebhookSDKException;

try {
    EventPublishResponse response = webhookClient.publishEvent(request);
} catch (EventPublishException e) {
    // Event publishing failed
    System.err.println("Event Type: " + e.getEventType());
    System.err.println("Status Code: " + e.getStatusCode());
    System.err.println("Error: " + e.getMessage());
} catch (InvalidConfigurationException e) {
    // Configuration error
    System.err.println("Property: " + e.getPropertyName());
    System.err.println("Value: " + e.getProvidedValue());
} catch (WebhookSDKException e) {
    // General SDK error
    System.err.println("Error: " + e.getMessage());
}
```

## Logging

The SDK uses SLF4J for logging. Configure your logging framework to see SDK logs:

```yaml
# application.yml
logging:
  level:
    com.webhook.sdk: DEBUG
```

## Example Application

See the `example/` directory for a complete Spring Boot application demonstrating all SDK features.

## Architecture

```
Your Application
      ↓
WebhookEventPublisherClient (Facade)
      ↓
   ┌──────────┬──────────┐
   ↓          ↓          ↓
Sync      Async       Retry
Publisher  Publisher   Logic
   ↓          ↓
RestTemplate WebClient
   ↓          ↓
   Event Publisher Lambda (POST /api/v1/events/publish)
           ↓
      Kafka Topic
           ↓
   Webhook Delivery Worker
           ↓
   Subscriber Webhooks
```

## Testing

Run tests with:

```bash
mvn test
```

## Building

Build the SDK:

```bash
mvn clean package
```

Install locally:

```bash
mvn clean install
```

## License

MIT License

## Support

For issues and questions, please open an issue on GitHub or contact the webhook system administrators.
