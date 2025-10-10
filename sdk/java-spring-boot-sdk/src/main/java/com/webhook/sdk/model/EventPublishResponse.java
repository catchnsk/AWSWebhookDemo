package com.webhook.sdk.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Data Transfer Object for event publishing responses.
 * <p>
 * This class contains the response information after attempting to publish
 * a webhook event, including success status, event identifier, and timestamp.
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
public class EventPublishResponse {

    /**
     * Indicates whether the event was successfully published.
     */
    private boolean success;

    /**
     * The unique identifier assigned to the published event.
     * <p>
     * This ID can be used to track the event lifecycle and delivery status.
     * Will be null if the publish operation failed.
     * </p>
     */
    private String eventId;

    /**
     * A descriptive message about the publish operation.
     * <p>
     * Contains success confirmation or error details depending on the operation result.
     * </p>
     */
    private String message;

    /**
     * The timestamp when the event was published.
     * <p>
     * Represents the server-side timestamp of the successful publish operation.
     * Will be null if the publish operation failed.
     * </p>
     */
    private LocalDateTime publishedAt;
}
