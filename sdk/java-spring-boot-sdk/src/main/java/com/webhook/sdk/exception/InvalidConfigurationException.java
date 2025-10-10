package com.webhook.sdk.exception;

/**
 * Exception thrown when the SDK is configured incorrectly.
 * <p>
 * This exception is thrown during SDK initialization or configuration when
 * required configuration properties are missing, invalid, or incompatible.
 * This typically occurs at application startup when auto-configuration is applied.
 * </p>
 *
 * @author Webhook SDK Team
 * @version 1.0
 * @since 1.0
 */
public class InvalidConfigurationException extends WebhookSDKException {

    /**
     * The name of the invalid or missing configuration property.
     */
    private final String propertyName;

    /**
     * The invalid value that was provided, if applicable.
     */
    private final String providedValue;

    /**
     * Constructs a new InvalidConfigurationException with the specified detail message.
     *
     * @param message the detail message explaining the configuration error
     */
    public InvalidConfigurationException(String message) {
        super(message);
        this.propertyName = null;
        this.providedValue = null;
    }

    /**
     * Constructs a new InvalidConfigurationException with the specified detail message and cause.
     *
     * @param message the detail message explaining the configuration error
     * @param cause   the cause of this exception
     */
    public InvalidConfigurationException(String message, Throwable cause) {
        super(message, cause);
        this.propertyName = null;
        this.providedValue = null;
    }

    /**
     * Constructs a new InvalidConfigurationException with property details.
     *
     * @param propertyName the name of the invalid configuration property
     * @param message      the detail message explaining the configuration error
     */
    public InvalidConfigurationException(String propertyName, String message) {
        super(message);
        this.propertyName = propertyName;
        this.providedValue = null;
    }

    /**
     * Constructs a new InvalidConfigurationException with full details.
     *
     * @param propertyName  the name of the invalid configuration property
     * @param providedValue the invalid value that was provided
     * @param message       the detail message explaining the configuration error
     */
    public InvalidConfigurationException(String propertyName, String providedValue, String message) {
        super(String.format("Invalid configuration for property '%s' with value '%s': %s",
                propertyName, providedValue, message));
        this.propertyName = propertyName;
        this.providedValue = providedValue;
    }

    /**
     * Gets the name of the invalid configuration property.
     *
     * @return the property name, or null if not specified
     */
    public String getPropertyName() {
        return propertyName;
    }

    /**
     * Gets the invalid value that was provided.
     *
     * @return the provided value, or null if not specified
     */
    public String getProvidedValue() {
        return providedValue;
    }
}
