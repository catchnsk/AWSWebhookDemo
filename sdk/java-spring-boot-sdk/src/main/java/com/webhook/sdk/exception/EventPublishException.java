package com.webhook.sdk.exception;

/**
 * Exception thrown when an event publishing operation fails.
 * <p>
 * This exception is thrown when the SDK encounters an error while attempting
 * to publish an event to the webhook service. This could be due to network issues,
 * server errors, validation failures, or other publish-related problems.
 * </p>
 *
 * @author Webhook SDK Team
 * @version 1.0
 * @since 1.0
 */
public class EventPublishException extends WebhookSDKException {

    /**
     * The event type that failed to publish.
     */
    private final String eventType;

    /**
     * The HTTP status code of the failed request, if applicable.
     */
    private final Integer statusCode;

    /**
     * Constructs a new EventPublishException with the specified detail message.
     *
     * @param message the detail message explaining the exception
     */
    public EventPublishException(String message) {
        super(message);
        this.eventType = null;
        this.statusCode = null;
    }

    /**
     * Constructs a new EventPublishException with the specified detail message and cause.
     *
     * @param message the detail message explaining the exception
     * @param cause   the cause of this exception
     */
    public EventPublishException(String message, Throwable cause) {
        super(message, cause);
        this.eventType = null;
        this.statusCode = null;
    }

    /**
     * Constructs a new EventPublishException with event type and detail message.
     *
     * @param eventType the type of event that failed to publish
     * @param message   the detail message explaining the exception
     */
    public EventPublishException(String eventType, String message) {
        super(message);
        this.eventType = eventType;
        this.statusCode = null;
    }

    /**
     * Constructs a new EventPublishException with full details.
     *
     * @param eventType  the type of event that failed to publish
     * @param message    the detail message explaining the exception
     * @param statusCode the HTTP status code of the failed request
     * @param cause      the cause of this exception
     */
    public EventPublishException(String eventType, String message, Integer statusCode, Throwable cause) {
        super(message, cause);
        this.eventType = eventType;
        this.statusCode = statusCode;
    }

    /**
     * Gets the event type that failed to publish.
     *
     * @return the event type, or null if not specified
     */
    public String getEventType() {
        return eventType;
    }

    /**
     * Gets the HTTP status code of the failed request.
     *
     * @return the status code, or null if not applicable
     */
    public Integer getStatusCode() {
        return statusCode;
    }
}
