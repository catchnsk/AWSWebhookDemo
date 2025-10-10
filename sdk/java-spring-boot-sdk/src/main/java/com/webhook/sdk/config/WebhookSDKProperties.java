package com.webhook.sdk.config;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Configuration properties for Webhook SDK
 */
@Data
@Validated
@ConfigurationProperties(prefix = "webhook.sdk")
public class WebhookSDKProperties {

    /**
     * Base URL of the webhook API (e.g., http://localhost:3005 or https://api.webhook.com)
     */
    @NotBlank(message = "Webhook API base URL is required")
    private String baseUrl = "http://localhost:3005";

    /**
     * Producer API key for authentication
     */
    @NotBlank(message = "API key is required")
    private String apiKey;

    /**
     * Producer ID (optional, used for tracking)
     */
    private String producerId;

    /**
     * Connection timeout in milliseconds
     */
    private int connectTimeout = 5000;

    /**
     * Read timeout in milliseconds
     */
    private int readTimeout = 30000;

    /**
     * Maximum retry attempts for failed requests
     */
    private int maxRetries = 3;

    /**
     * Enable/disable async publishing
     */
    private boolean asyncEnabled = true;

    /**
     * Thread pool size for async operations
     */
    private int asyncThreadPoolSize = 10;

    /**
     * Enable/disable request logging
     */
    private boolean loggingEnabled = true;
}
