package com.webhook.sdk.example.service;

import com.webhook.sdk.client.WebhookEventPublisherClient;
import com.webhook.sdk.example.model.User;
import com.webhook.sdk.model.EventPublishRequest;
import com.webhook.sdk.model.EventPublishResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/**
 * Service class demonstrating ASYNCHRONOUS event publishing for non-critical operations.
 * <p>
 * User events are important but not critical enough to block the main operation.
 * This service uses asynchronous publishing to improve performance and user experience.
 * Events are published in the background, and failures are logged without blocking
 * the user registration flow.
 * </p>
 *
 * <h3>Key Features Demonstrated:</h3>
 * <ul>
 *   <li>Asynchronous event publishing for non-critical operations</li>
 *   <li>Non-blocking event publishing</li>
 *   <li>Callback handling for async operations</li>
 *   <li>Batch event publishing</li>
 *   <li>Fire-and-forget pattern</li>
 * </ul>
 *
 * @see WebhookEventPublisherClient#publishEventAsync
 * @see WebhookEventPublisherClient#publishEventsAsync
 */
@Slf4j
@Service
public class UserService {

    private final WebhookEventPublisherClient webhookClient;

    // In-memory storage for demo purposes
    private final Map<String, User> userStorage = new HashMap<>();

    public UserService(WebhookEventPublisherClient webhookClient) {
        this.webhookClient = webhookClient;
        log.info("UserService initialized with WebhookEventPublisherClient");
    }

    /**
     * Creates a new user and publishes a user.created event asynchronously.
     * <p>
     * This method demonstrates asynchronous event publishing for non-critical operations.
     * The user is saved immediately, and the event is published in the background.
     * This provides better performance and user experience.
     * </p>
     *
     * @param user the user to create
     * @return the created user with generated ID and timestamps
     */
    public User createUser(User user) {
        log.info("Creating new user: {}", user.getEmail());

        // Generate user ID and timestamps
        user.setUserId(UUID.randomUUID().toString());
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        user.setAccountStatus("ACTIVE");

        // Save user immediately - don't wait for event publishing
        userStorage.put(user.getUserId(), user);
        log.info("User created successfully: {}", user.getUserId());

        // Publish event asynchronously (fire-and-forget with callback)
        publishUserCreatedEventAsync(user);

        return user;
    }

    /**
     * Updates user profile and publishes a user.profile_updated event asynchronously.
     *
     * @param userId the user ID
     * @param updates the updates to apply
     * @return the updated user
     */
    public User updateUserProfile(String userId, Map<String, Object> updates) {
        log.info("Updating user profile: {}", userId);

        User user = userStorage.get(userId);
        if (user == null) {
            throw new NoSuchElementException("User not found: " + userId);
        }

        // Apply updates (simplified for demo)
        if (updates.containsKey("firstName")) {
            user.setFirstName((String) updates.get("firstName"));
        }
        if (updates.containsKey("lastName")) {
            user.setLastName((String) updates.get("lastName"));
        }
        if (updates.containsKey("phoneNumber")) {
            user.setPhoneNumber((String) updates.get("phoneNumber"));
        }

        user.setUpdatedAt(LocalDateTime.now());

        // Save user
        userStorage.put(userId, user);

        // Publish event asynchronously
        publishUserProfileUpdatedEventAsync(user, updates);

        return user;
    }

    /**
     * Records a user login and publishes a user.logged_in event asynchronously.
     * <p>
     * Login events are tracked for analytics and security monitoring but should
     * not block the login process.
     * </p>
     *
     * @param userId    the user ID
     * @param ipAddress the login IP address
     * @param userAgent the user agent string
     */
    public void recordUserLogin(String userId, String ipAddress, String userAgent) {
        log.info("Recording login for user: {}", userId);

        User user = userStorage.get(userId);
        if (user == null) {
            log.warn("User not found for login event: {}", userId);
            return;
        }

        user.setLastLoginAt(LocalDateTime.now());
        userStorage.put(userId, user);

        // Publish login event asynchronously
        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", userId);
        payload.put("email", user.getEmail());
        payload.put("loginAt", LocalDateTime.now().toString());
        payload.put("ipAddress", ipAddress);
        payload.put("userAgent", userAgent);
        payload.put("location", "Unknown"); // Could integrate with GeoIP service

        EventPublishRequest eventRequest = EventPublishRequest.builder()
            .eventType("user.logged_in")
            .schemaId("user-login-schema-v1")
            .payload(payload)
            .build();

        // Fire and forget - login event failure should not affect user experience
        webhookClient.publishEventAsync(eventRequest)
            .thenAccept(response -> log.info("Published user.logged_in event - EventID: {}", response.getEventId()))
            .exceptionally(ex -> {
                log.warn("Failed to publish user.logged_in event for user {}: {}", userId, ex.getMessage());
                // Could queue for retry in a production system
                return null;
            });
    }

    /**
     * Deactivates a user account and publishes a user.deactivated event.
     *
     * @param userId the user ID to deactivate
     * @param reason the deactivation reason
     * @return the deactivated user
     */
    public User deactivateUser(String userId, String reason) {
        log.info("Deactivating user: {} - Reason: {}", userId, reason);

        User user = userStorage.get(userId);
        if (user == null) {
            throw new NoSuchElementException("User not found: " + userId);
        }

        user.setAccountStatus("DEACTIVATED");
        user.setUpdatedAt(LocalDateTime.now());
        userStorage.put(userId, user);

        // Publish deactivation event
        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", userId);
        payload.put("email", user.getEmail());
        payload.put("deactivatedAt", LocalDateTime.now().toString());
        payload.put("reason", reason);
        payload.put("previousStatus", "ACTIVE");

        EventPublishRequest eventRequest = EventPublishRequest.builder()
            .eventType("user.deactivated")
            .schemaId("user-deactivated-schema-v1")
            .payload(payload)
            .build();

        webhookClient.publishEventAsync(eventRequest)
            .thenAccept(response -> log.info("Published user.deactivated event - EventID: {}", response.getEventId()))
            .exceptionally(ex -> {
                log.error("Failed to publish user.deactivated event: {}", ex.getMessage(), ex);
                return null;
            });

        return user;
    }

    /**
     * Publishes multiple user events in a batch asynchronously.
     * <p>
     * Demonstrates batch publishing for bulk operations like data imports,
     * batch updates, or periodic sync operations.
     * </p>
     *
     * @param users list of users to publish events for
     * @return CompletableFuture that completes when all events are published
     */
    public CompletableFuture<EventPublishResponse[]> publishBatchUserEvents(List<User> users) {
        log.info("Publishing batch events for {} users", users.size());

        EventPublishRequest[] eventRequests = users.stream()
            .map(this::createUserEventRequest)
            .toArray(EventPublishRequest[]::new);

        return webhookClient.publishEventsAsync(eventRequests)
            .thenApply(responses -> {
                log.info("Successfully published {} user events", responses.length);
                return responses;
            })
            .exceptionally(ex -> {
                log.error("Failed to publish batch user events: {}", ex.getMessage(), ex);
                return new EventPublishResponse[0];
            });
    }

    /**
     * Retrieves a user by ID.
     *
     * @param userId the user ID
     * @return the user
     */
    public Optional<User> getUser(String userId) {
        return Optional.ofNullable(userStorage.get(userId));
    }

    /**
     * Lists all users.
     *
     * @return list of all users
     */
    public List<User> getAllUsers() {
        return new ArrayList<>(userStorage.values());
    }

    // ==================== Private Helper Methods ====================

    /**
     * Publishes user.created event asynchronously with proper error handling.
     */
    private void publishUserCreatedEventAsync(User user) {
        Map<String, Object> payload = buildUserPayload(user);

        EventPublishRequest eventRequest = EventPublishRequest.builder()
            .eventType("user.created")
            .schemaId("user-schema-v1")
            .payload(payload)
            .build();

        log.debug("Publishing user.created event asynchronously for user: {}", user.getUserId());

        webhookClient.publishEventAsync(eventRequest)
            .thenAccept(response -> {
                log.info("Successfully published user.created event - EventID: {}, UserID: {}",
                    response.getEventId(), user.getUserId());
            })
            .exceptionally(ex -> {
                // In production, you might want to:
                // 1. Queue the event for retry
                // 2. Store in dead-letter queue
                // 3. Send alert to monitoring system
                log.error("Failed to publish user.created event for user {}: {}",
                    user.getUserId(), ex.getMessage());
                return null;
            });
    }

    /**
     * Publishes user.profile_updated event asynchronously.
     */
    private void publishUserProfileUpdatedEventAsync(User user, Map<String, Object> updates) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", user.getUserId());
        payload.put("email", user.getEmail());
        payload.put("updatedAt", user.getUpdatedAt().toString());
        payload.put("updates", updates);

        EventPublishRequest eventRequest = EventPublishRequest.builder()
            .eventType("user.profile_updated")
            .schemaId("user-profile-schema-v1")
            .payload(payload)
            .build();

        webhookClient.publishEventAsync(eventRequest)
            .thenAccept(response -> log.info("Published user.profile_updated event - EventID: {}", response.getEventId()))
            .exceptionally(ex -> {
                log.warn("Failed to publish user.profile_updated event: {}", ex.getMessage());
                return null;
            });
    }

    /**
     * Creates an event request from a user object.
     */
    private EventPublishRequest createUserEventRequest(User user) {
        return EventPublishRequest.builder()
            .eventType("user.created")
            .schemaId("user-schema-v1")
            .payload(buildUserPayload(user))
            .build();
    }

    /**
     * Builds the event payload from a user object.
     */
    private Map<String, Object> buildUserPayload(User user) {
        Map<String, Object> payload = new HashMap<>();

        // User identification
        payload.put("userId", user.getUserId());
        payload.put("email", user.getEmail());
        payload.put("username", user.getUsername());

        // Personal information
        payload.put("firstName", user.getFirstName());
        payload.put("lastName", user.getLastName());
        payload.put("phoneNumber", user.getPhoneNumber());

        // Account information
        payload.put("accountStatus", user.getAccountStatus());
        payload.put("accountType", user.getAccountType());
        payload.put("roles", user.getRoles());

        // Address
        if (user.getAddress() != null) {
            Map<String, Object> address = new HashMap<>();
            address.put("street", user.getAddress().getStreet());
            address.put("city", user.getAddress().getCity());
            address.put("state", user.getAddress().getState());
            address.put("zipCode", user.getAddress().getZipCode());
            address.put("country", user.getAddress().getCountry());
            payload.put("address", address);
        }

        // Preferences
        if (user.getPreferences() != null) {
            Map<String, Object> preferences = new HashMap<>();
            preferences.put("marketingEmails", user.getPreferences().isMarketingEmails());
            preferences.put("newsletterSubscription", user.getPreferences().isNewsletterSubscription());
            preferences.put("smsNotifications", user.getPreferences().isSmsNotifications());
            preferences.put("language", user.getPreferences().getLanguage());
            preferences.put("timezone", user.getPreferences().getTimezone());
            preferences.put("theme", user.getPreferences().getTheme());
            payload.put("preferences", preferences);
        }

        // Metadata
        payload.put("createdAt", user.getCreatedAt().toString());
        payload.put("updatedAt", user.getUpdatedAt().toString());
        if (user.getLastLoginAt() != null) {
            payload.put("lastLoginAt", user.getLastLoginAt().toString());
        }

        // Security flags
        payload.put("emailVerified", user.isEmailVerified());
        payload.put("phoneVerified", user.isPhoneVerified());
        payload.put("twoFactorEnabled", user.isTwoFactorEnabled());

        return payload;
    }
}
