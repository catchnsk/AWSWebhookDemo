package com.webhook.sdk.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Data Transfer Object for event publishing requests.
 * <p>
 * This class encapsulates the information required to publish a webhook event,
 * including the event type, schema identifier, and the event payload.
 * </p>
 *
 * @author Webhook SDK Team
 * @version 1.0
 * @since 1.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventPublishRequest {

    /**
     * The type of event being published.
     * <p>
     * This should correspond to a registered event type in the webhook system.
     * Examples: "user.created", "order.completed", "payment.processed"
     * </p>
     */
    @NotBlank(message = "Event type cannot be blank")
    private String eventType;

    /**
     * The schema identifier for the event payload.
     * <p>
     * This references the JSON schema that validates the event payload structure.
     * </p>
     */
    @NotBlank(message = "Schema ID cannot be blank")
    private String schemaId;

    /**
     * The event payload containing the actual event data.
     * <p>
     * This map should conform to the structure defined by the referenced schema.
     * Keys represent field names and values represent the corresponding data.
     * </p>
     */
    @NotNull(message = "Payload cannot be null")
    private Map<String, Object> payload;
}
