package com.webhook.sdk.client;

import com.webhook.sdk.model.EventPublishRequest;
import com.webhook.sdk.model.EventPublishResponse;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;

import java.util.concurrent.CompletableFuture;

/**
 * Main facade client for the Webhook Event Publisher SDK.
 * <p>
 * This is the primary entry point for publishing webhook events. It provides both
 * synchronous and asynchronous methods for event publishing, delegating to the
 * appropriate publisher implementation.
 * </p>
 * <p>
 * Usage example (synchronous):
 * <pre>
 * EventPublishRequest request = EventPublishRequest.builder()
 *     .eventType("user.created")
 *     .schemaId("user-schema-v1")
 *     .payload(Map.of("userId", "123", "email", "user@example.com"))
 *     .build();
 *
 * EventPublishResponse response = client.publishEvent(request);
 * </pre>
 * </p>
 * <p>
 * Usage example (asynchronous):
 * <pre>
 * CompletableFuture&lt;EventPublishResponse&gt; future = client.publishEventAsync(request);
 * future.thenAccept(response -&gt; {
 *     System.out.println("Event published: " + response.getEventId());
 * });
 * </pre>
 * </p>
 *
 * @author Webhook SDK Team
 * @version 1.0
 * @since 1.0
 */
@Slf4j
@Validated
public class WebhookEventPublisherClient {

    private final SyncEventPublisher syncPublisher;
    private final AsyncEventPublisher asyncPublisher;

    /**
     * Constructs a new WebhookEventPublisherClient with the specified publishers.
     *
     * @param syncPublisher  the synchronous event publisher
     * @param asyncPublisher the asynchronous event publisher
     */
    public WebhookEventPublisherClient(SyncEventPublisher syncPublisher,
                                        AsyncEventPublisher asyncPublisher) {
        this.syncPublisher = syncPublisher;
        this.asyncPublisher = asyncPublisher;
        log.info("WebhookEventPublisherClient initialized with sync and async publishers");
    }

    /**
     * Publishes an event synchronously to the webhook service.
     * <p>
     * This method blocks until the server responds or an error occurs.
     * The event is automatically validated before publishing.
     * </p>
     *
     * @param request the event publish request containing event details and payload
     * @return the event publish response with event ID and timestamp
     * @throws com.webhook.sdk.exception.EventPublishException if the event publishing fails
     * @throws jakarta.validation.ValidationException           if the request validation fails
     */
    public EventPublishResponse publishEvent(@Valid EventPublishRequest request) {
        log.debug("Delegating event publish to synchronous publisher");
        return syncPublisher.publishEvent(request);
    }

    /**
     * Publishes an event asynchronously to the webhook service.
     * <p>
     * This method returns immediately with a CompletableFuture that will be completed
     * when the server responds. The event is automatically validated before publishing.
     * </p>
     *
     * @param request the event publish request containing event details and payload
     * @return a CompletableFuture that completes with the event publish response
     */
    public CompletableFuture<EventPublishResponse> publishEventAsync(@Valid EventPublishRequest request) {
        log.debug("Delegating event publish to asynchronous publisher");
        return asyncPublisher.publishEventAsync(request);
    }

    /**
     * Publishes multiple events asynchronously in parallel.
     * <p>
     * This method publishes multiple events concurrently and returns a CompletableFuture
     * that completes when all events have been published or if any fail.
     * All requests are validated before publishing.
     * </p>
     *
     * @param requests the array of event publish requests
     * @return a CompletableFuture that completes with an array of event publish responses
     */
    public CompletableFuture<EventPublishResponse[]> publishEventsAsync(@Valid EventPublishRequest... requests) {
        log.debug("Delegating batch event publish to asynchronous publisher");
        return asyncPublisher.publishEventsAsync(requests);
    }

    /**
     * Publishes an event synchronously with retry logic.
     * <p>
     * This method attempts to publish the event, retrying up to the specified
     * number of times if transient errors occur.
     * </p>
     *
     * @param request    the event publish request
     * @param maxRetries the maximum number of retry attempts
     * @return the event publish response
     * @throws com.webhook.sdk.exception.EventPublishException if all retry attempts fail
     */
    public EventPublishResponse publishEventWithRetry(@Valid EventPublishRequest request, int maxRetries) {
        log.debug("Publishing event with retry logic: maxRetries={}", maxRetries);

        Exception lastException = null;
        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    log.info("Retry attempt {} of {} for event type: {}",
                            attempt, maxRetries, request.getEventType());
                }
                return syncPublisher.publishEvent(request);
            } catch (Exception e) {
                lastException = e;
                log.warn("Event publish attempt {} failed: {}", attempt + 1, e.getMessage());

                if (attempt < maxRetries) {
                    try {
                        // Exponential backoff: 100ms, 200ms, 400ms, etc.
                        long waitTime = (long) (100 * Math.pow(2, attempt));
                        log.debug("Waiting {}ms before retry", waitTime);
                        Thread.sleep(waitTime);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Retry interrupted", ie);
                    }
                }
            }
        }

        log.error("All {} retry attempts failed for event type: {}",
                maxRetries + 1, request.getEventType());
        throw new RuntimeException("Failed to publish event after " + (maxRetries + 1) + " attempts",
                lastException);
    }

    /**
     * Publishes an event asynchronously with retry logic.
     * <p>
     * This method attempts to publish the event asynchronously, retrying up to the
     * specified number of times if transient errors occur.
     * </p>
     *
     * @param request    the event publish request
     * @param maxRetries the maximum number of retry attempts
     * @return a CompletableFuture that completes with the event publish response
     */
    public CompletableFuture<EventPublishResponse> publishEventAsyncWithRetry(
            @Valid EventPublishRequest request, int maxRetries) {
        log.debug("Publishing event asynchronously with retry logic: maxRetries={}", maxRetries);

        return CompletableFuture.supplyAsync(() -> {
            return publishEventWithRetry(request, maxRetries);
        });
    }
}
