package com.webhook.sdk.config;

import com.webhook.sdk.client.AsyncEventPublisher;
import com.webhook.sdk.client.SyncEventPublisher;
import com.webhook.sdk.client.WebhookEventPublisherClient;
import com.webhook.sdk.exception.InvalidConfigurationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;

/**
 * Spring Boot auto-configuration for the Webhook Event Publisher SDK.
 * <p>
 * This class automatically configures all necessary beans for the Webhook SDK
 * when included in a Spring Boot application. It sets up both synchronous and
 * asynchronous publishers along with the main client facade.
 * </p>
 * <p>
 * Configuration properties (application.yml/properties):
 * <pre>
 * webhook:
 *   sdk:
 *     enabled: true                           # Enable/disable SDK (default: true)
 *     base-url: http://localhost:8080        # Webhook service URL (required)
 *     api-key: your-api-key                  # API key for authentication (required)
 *     timeout:
 *       connect: 5000                         # Connection timeout in ms (default: 5000)
 *       read: 30000                          # Read timeout in ms (default: 30000)
 * </pre>
 * </p>
 *
 * @author Webhook SDK Team
 * @version 1.0
 * @since 1.0
 */
@Slf4j
@AutoConfiguration
@ConditionalOnProperty(
        prefix = "webhook.sdk",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true
)
public class WebhookSDKAutoConfiguration {

    @Value("${webhook.sdk.base-url:}")
    private String baseUrl;

    @Value("${webhook.sdk.api-key:}")
    private String apiKey;

    @Value("${webhook.sdk.timeout.connect:5000}")
    private int connectTimeout;

    @Value("${webhook.sdk.timeout.read:30000}")
    private int readTimeout;

    /**
     * Creates a RestTemplate bean configured for the Webhook SDK.
     * <p>
     * This RestTemplate is used by the synchronous event publisher and includes
     * configured timeouts for connection and read operations.
     * </p>
     *
     * @return configured RestTemplate instance
     */
    @Bean
    @ConditionalOnMissingBean(name = "webhookRestTemplate")
    public RestTemplate webhookRestTemplate() {
        validateConfiguration();

        log.info("Creating webhookRestTemplate with connectTimeout={}ms, readTimeout={}ms",
                connectTimeout, readTimeout);

        ClientHttpRequestFactory requestFactory = createRequestFactory();
        RestTemplate restTemplate = new RestTemplate(requestFactory);

        log.debug("webhookRestTemplate created successfully");
        return restTemplate;
    }

    /**
     * Creates a WebClient bean configured for the Webhook SDK.
     * <p>
     * This WebClient is used by the asynchronous event publisher and includes
     * configured base URL, authentication, and timeout settings.
     * </p>
     *
     * @return configured WebClient instance
     */
    @Bean
    @ConditionalOnMissingBean(name = "webhookWebClient")
    public WebClient webhookWebClient() {
        validateConfiguration();

        log.info("Creating webhookWebClient with baseUrl={}", baseUrl);

        WebClient webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, "application/json")
                .defaultHeader("X-API-Key", apiKey)
                .codecs(configurer -> configurer
                        .defaultCodecs()
                        .maxInMemorySize(16 * 1024 * 1024)) // 16MB buffer
                .build();

        log.debug("webhookWebClient created successfully");
        return webClient;
    }

    /**
     * Creates the synchronous event publisher bean.
     *
     * @param restTemplate the configured RestTemplate
     * @return SyncEventPublisher instance
     */
    @Bean
    @ConditionalOnMissingBean
    public SyncEventPublisher syncEventPublisher(RestTemplate webhookRestTemplate) {
        log.info("Creating SyncEventPublisher bean");
        return new SyncEventPublisher(webhookRestTemplate, baseUrl, apiKey);
    }

    /**
     * Creates the asynchronous event publisher bean.
     *
     * @param webClient the configured WebClient
     * @return AsyncEventPublisher instance
     */
    @Bean
    @ConditionalOnMissingBean
    public AsyncEventPublisher asyncEventPublisher(WebClient webhookWebClient) {
        log.info("Creating AsyncEventPublisher bean");
        return new AsyncEventPublisher(webhookWebClient);
    }

    /**
     * Creates the main Webhook Event Publisher client facade bean.
     * <p>
     * This is the primary client that applications should inject and use
     * for publishing events.
     * </p>
     *
     * @param syncPublisher  the synchronous event publisher
     * @param asyncPublisher the asynchronous event publisher
     * @return WebhookEventPublisherClient instance
     */
    @Bean
    @ConditionalOnMissingBean
    public WebhookEventPublisherClient webhookEventPublisherClient(
            SyncEventPublisher syncPublisher,
            AsyncEventPublisher asyncPublisher) {
        log.info("Creating WebhookEventPublisherClient bean");
        WebhookEventPublisherClient client = new WebhookEventPublisherClient(syncPublisher, asyncPublisher);
        log.info("Webhook SDK auto-configuration completed successfully");
        return client;
    }

    /**
     * Creates a configured ClientHttpRequestFactory with timeouts.
     *
     * @return configured ClientHttpRequestFactory
     */
    private ClientHttpRequestFactory createRequestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(connectTimeout));
        factory.setReadTimeout(Duration.ofMillis(readTimeout));
        return factory;
    }

    /**
     * Validates the SDK configuration.
     *
     * @throws InvalidConfigurationException if required configuration is missing or invalid
     */
    private void validateConfiguration() {
        if (baseUrl == null || baseUrl.trim().isEmpty()) {
            String errorMsg = "Webhook SDK base URL is not configured. " +
                    "Please set 'webhook.sdk.base-url' property.";
            log.error(errorMsg);
            throw new InvalidConfigurationException("webhook.sdk.base-url", errorMsg);
        }

        if (apiKey == null || apiKey.trim().isEmpty()) {
            String errorMsg = "Webhook SDK API key is not configured. " +
                    "Please set 'webhook.sdk.api-key' property.";
            log.error(errorMsg);
            throw new InvalidConfigurationException("webhook.sdk.api-key", errorMsg);
        }

        if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
            String errorMsg = "Webhook SDK base URL must start with http:// or https://";
            log.error(errorMsg + " - Provided: {}", baseUrl);
            throw new InvalidConfigurationException("webhook.sdk.base-url", baseUrl, errorMsg);
        }

        if (connectTimeout <= 0) {
            String errorMsg = "Connect timeout must be greater than 0";
            log.error(errorMsg + " - Provided: {}", connectTimeout);
            throw new InvalidConfigurationException(
                    "webhook.sdk.timeout.connect",
                    String.valueOf(connectTimeout),
                    errorMsg
            );
        }

        if (readTimeout <= 0) {
            String errorMsg = "Read timeout must be greater than 0";
            log.error(errorMsg + " - Provided: {}", readTimeout);
            throw new InvalidConfigurationException(
                    "webhook.sdk.timeout.read",
                    String.valueOf(readTimeout),
                    errorMsg
            );
        }

        log.debug("Webhook SDK configuration validated successfully");
    }
}
