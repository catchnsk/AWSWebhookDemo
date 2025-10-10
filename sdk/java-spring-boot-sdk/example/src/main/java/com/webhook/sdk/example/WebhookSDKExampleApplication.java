package com.webhook.sdk.example;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

/**
 * Main Spring Boot application class for Webhook SDK Example.
 * <p>
 * This application demonstrates the usage of the Webhook Event Publisher SDK
 * in a production-quality Spring Boot application. It showcases:
 * <ul>
 *   <li>Synchronous event publishing for critical operations (order processing)</li>
 *   <li>Asynchronous event publishing for non-critical operations (user events)</li>
 *   <li>Batch event publishing</li>
 *   <li>Error handling and retry logic</li>
 *   <li>Different event types and payloads</li>
 * </ul>
 * </p>
 *
 * <h2>Getting Started</h2>
 * <p>
 * 1. Configure the SDK in application.yml or via environment variables:
 * <pre>
 *    export WEBHOOK_API_URL=http://localhost:3005
 *    export WEBHOOK_API_KEY=your-api-key-here
 * </pre>
 * </p>
 * <p>
 * 2. Run the application:
 * <pre>
 *    mvn spring-boot:run
 * </pre>
 * </p>
 * <p>
 * 3. Access the demo endpoints at http://localhost:8080/api
 * </p>
 *
 * @author Webhook SDK Team
 * @version 1.0.0
 * @see com.webhook.sdk.client.WebhookEventPublisherClient
 */
@Slf4j
@SpringBootApplication
@ComponentScan(basePackages = {
    "com.webhook.sdk.example",
    "com.webhook.sdk.config"  // Include SDK auto-configuration
})
public class WebhookSDKExampleApplication {

    /**
     * Main method to start the Spring Boot application.
     *
     * @param args command line arguments
     */
    public static void main(String[] args) {
        log.info("Starting Webhook SDK Example Application...");
        SpringApplication.run(WebhookSDKExampleApplication.class, args);
        log.info("Webhook SDK Example Application started successfully");
        log.info("Access the API at: http://localhost:8080/api");
        log.info("Try the following endpoints:");
        log.info("  - POST /api/demo/orders          - Create order (sync publishing)");
        log.info("  - POST /api/demo/users           - Create user (async publishing)");
        log.info("  - POST /api/demo/batch           - Batch event publishing");
        log.info("  - GET  /api/demo/health          - Health check");
    }
}
