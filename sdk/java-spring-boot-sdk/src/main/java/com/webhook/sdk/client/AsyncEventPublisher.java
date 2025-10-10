package com.webhook.sdk.client;

import com.webhook.sdk.exception.EventPublishException;
import com.webhook.sdk.model.ApiResponse;
import com.webhook.sdk.model.EventPublishRequest;
import com.webhook.sdk.model.EventPublishResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.util.concurrent.CompletableFuture;

/**
 * Asynchronous event publisher using WebClient.
 * <p>
 * This class provides asynchronous (non-blocking) methods to publish webhook events
 * to the webhook service. It uses Spring's WebClient for reactive HTTP communication
 * and returns CompletableFuture for async/await patterns.
 * </p>
 *
 * @author Webhook SDK Team
 * @version 1.0
 * @since 1.0
 */
@Slf4j
public class AsyncEventPublisher {

    private final WebClient webClient;

    /**
     * Constructs a new AsyncEventPublisher with the specified WebClient.
     *
     * @param webClient the WebClient instance configured with base URL and authentication
     */
    public AsyncEventPublisher(WebClient webClient) {
        this.webClient = webClient;
    }

    /**
     * Publishes an event asynchronously to the webhook service.
     * <p>
     * This method returns immediately with a CompletableFuture that will be completed
     * when the server responds. The event is validated against its schema before being published.
     * </p>
     *
     * @param request the event publish request containing event details and payload
     * @return a CompletableFuture that completes with the event publish response
     */
    public CompletableFuture<EventPublishResponse> publishEventAsync(EventPublishRequest request) {
        log.info("Publishing event asynchronously: type={}, schemaId={}",
                request.getEventType(), request.getSchemaId());

        return webClient.post()
                .uri("/api/events/publish")
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<ApiResponse<EventPublishResponse>>() {
                })
                .flatMap(this::processResponse)
                .doOnSuccess(response -> log.info(
                        "Event published successfully (async): eventId={}, publishedAt={}",
                        response.getEventId(), response.getPublishedAt()
                ))
                .doOnError(error -> log.error(
                        "Error publishing event asynchronously: type={}, error={}",
                        request.getEventType(), error.getMessage()
                ))
                .onErrorMap(this::handleError)
                .toFuture();
    }

    /**
     * Publishes multiple events asynchronously in parallel.
     * <p>
     * This method publishes multiple events concurrently and returns a CompletableFuture
     * that completes when all events have been published or if any fail.
     * </p>
     *
     * @param requests the array of event publish requests
     * @return a CompletableFuture that completes with an array of event publish responses
     */
    public CompletableFuture<EventPublishResponse[]> publishEventsAsync(EventPublishRequest... requests) {
        log.info("Publishing {} events asynchronously in parallel", requests.length);

        CompletableFuture<EventPublishResponse>[] futures =
                new CompletableFuture[requests.length];

        for (int i = 0; i < requests.length; i++) {
            futures[i] = publishEventAsync(requests[i]);
        }

        return CompletableFuture.allOf(futures)
                .thenApply(v -> {
                    EventPublishResponse[] responses = new EventPublishResponse[futures.length];
                    for (int i = 0; i < futures.length; i++) {
                        responses[i] = futures[i].join();
                    }
                    log.info("All {} events published successfully", responses.length);
                    return responses;
                });
    }

    /**
     * Processes the API response and extracts the event publish response.
     *
     * @param apiResponse the wrapped API response
     * @return a Mono containing the event publish response
     */
    private Mono<EventPublishResponse> processResponse(ApiResponse<EventPublishResponse> apiResponse) {
        if (apiResponse == null) {
            return Mono.error(new EventPublishException("Received null response from webhook service"));
        }

        if (!apiResponse.isSuccess() || apiResponse.getData() == null) {
            String errorMessage = apiResponse.getMessage() != null
                    ? apiResponse.getMessage()
                    : "Event publish failed with no error message";
            return Mono.error(new EventPublishException(errorMessage));
        }

        return Mono.just(apiResponse.getData());
    }

    /**
     * Handles errors from the WebClient and converts them to EventPublishException.
     *
     * @param throwable the error that occurred
     * @return an EventPublishException with appropriate details
     */
    private Throwable handleError(Throwable throwable) {
        if (throwable instanceof EventPublishException) {
            return throwable;
        }

        if (throwable instanceof WebClientResponseException webClientException) {
            log.error("HTTP error while publishing event: status={}, body={}",
                    webClientException.getStatusCode(),
                    webClientException.getResponseBodyAsString());

            return new EventPublishException(
                    null,
                    "Failed to publish event: " + webClientException.getMessage(),
                    webClientException.getStatusCode().value(),
                    webClientException
            );
        }

        log.error("Unexpected error while publishing event asynchronously", throwable);
        return new EventPublishException(
                "Unexpected error: " + throwable.getMessage(),
                throwable
        );
    }
}
