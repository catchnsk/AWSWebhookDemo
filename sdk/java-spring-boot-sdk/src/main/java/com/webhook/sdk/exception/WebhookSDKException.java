package com.webhook.sdk.exception;

/**
 * Base exception class for all Webhook SDK related exceptions.
 * <p>
 * This is the parent exception class for all custom exceptions thrown by the
 * Webhook Event Publisher SDK. It provides a consistent exception hierarchy
 * for error handling.
 * </p>
 *
 * @author Webhook SDK Team
 * @version 1.0
 * @since 1.0
 */
public class WebhookSDKException extends RuntimeException {

    /**
     * Constructs a new WebhookSDKException with the specified detail message.
     *
     * @param message the detail message explaining the exception
     */
    public WebhookSDKException(String message) {
        super(message);
    }

    /**
     * Constructs a new WebhookSDKException with the specified detail message and cause.
     *
     * @param message the detail message explaining the exception
     * @param cause   the cause of this exception
     */
    public WebhookSDKException(String message, Throwable cause) {
        super(message, cause);
    }

    /**
     * Constructs a new WebhookSDKException with the specified cause.
     *
     * @param cause the cause of this exception
     */
    public WebhookSDKException(Throwable cause) {
        super(cause);
    }
}
