package com.webhook.sdk.client;

import com.webhook.sdk.exception.EventPublishException;
import com.webhook.sdk.model.ApiResponse;
import com.webhook.sdk.model.EventPublishRequest;
import com.webhook.sdk.model.EventPublishResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

/**
 * Synchronous event publisher using RestTemplate.
 * <p>
 * This class provides synchronous (blocking) methods to publish webhook events
 * to the webhook service. It uses Spring's RestTemplate for HTTP communication
 * and handles request/response mapping and error handling.
 * </p>
 *
 * @author Webhook SDK Team
 * @version 1.0
 * @since 1.0
 */
@Slf4j
public class SyncEventPublisher {

    private final RestTemplate restTemplate;
    private final String baseUrl;
    private final String apiKey;

    /**
     * Constructs a new SyncEventPublisher with the specified configuration.
     *
     * @param restTemplate the RestTemplate instance for HTTP communication
     * @param baseUrl      the base URL of the webhook service
     * @param apiKey       the API key for authentication
     */
    public SyncEventPublisher(RestTemplate restTemplate, String baseUrl, String apiKey) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }

    /**
     * Publishes an event synchronously to the webhook service.
     * <p>
     * This method blocks until the server responds or an error occurs.
     * The event is validated against its schema before being published.
     * </p>
     *
     * @param request the event publish request containing event details and payload
     * @return the event publish response with event ID and timestamp
     * @throws EventPublishException if the event publishing fails
     */
    public EventPublishResponse publishEvent(EventPublishRequest request) {
        log.info("Publishing event synchronously: type={}, schemaId={}",
                request.getEventType(), request.getSchemaId());

        try {
            String url = baseUrl + "/api/events/publish";
            HttpHeaders headers = createHeaders();
            HttpEntity<EventPublishRequest> httpEntity = new HttpEntity<>(request, headers);

            log.debug("Sending POST request to: {}", url);

            ResponseEntity<ApiResponse<EventPublishResponse>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    httpEntity,
                    new ParameterizedTypeReference<ApiResponse<EventPublishResponse>>() {
                    }
            );

            ApiResponse<EventPublishResponse> apiResponse = response.getBody();

            if (apiResponse == null) {
                log.error("Received null response body from webhook service");
                throw new EventPublishException(
                        request.getEventType(),
                        "Received null response from webhook service"
                );
            }

            if (!apiResponse.isSuccess() || apiResponse.getData() == null) {
                log.error("Event publish failed: {}", apiResponse.getMessage());
                throw new EventPublishException(
                        request.getEventType(),
                        apiResponse.getMessage() != null
                                ? apiResponse.getMessage()
                                : "Event publish failed with no error message"
                );
            }

            EventPublishResponse publishResponse = apiResponse.getData();
            log.info("Event published successfully: eventId={}, publishedAt={}",
                    publishResponse.getEventId(), publishResponse.getPublishedAt());

            return publishResponse;

        } catch (HttpStatusCodeException e) {
            log.error("HTTP error while publishing event: status={}, body={}",
                    e.getStatusCode(), e.getResponseBodyAsString(), e);
            throw new EventPublishException(
                    request.getEventType(),
                    "Failed to publish event: " + e.getMessage(),
                    e.getStatusCode().value(),
                    e
            );
        } catch (RestClientException e) {
            log.error("REST client error while publishing event", e);
            throw new EventPublishException(
                    request.getEventType(),
                    "Network error while publishing event: " + e.getMessage(),
                    null,
                    e
            );
        } catch (Exception e) {
            log.error("Unexpected error while publishing event", e);
            throw new EventPublishException(
                    request.getEventType(),
                    "Unexpected error: " + e.getMessage(),
                    null,
                    e
            );
        }
    }

    /**
     * Creates HTTP headers with authentication and content type.
     *
     * @return configured HTTP headers
     */
    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-API-Key", apiKey);
        return headers;
    }
}
