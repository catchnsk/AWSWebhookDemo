package com.webhook.sdk.example.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Domain model representing a User in the example application.
 * <p>
 * This model is used to demonstrate asynchronous event publishing
 * for non-critical operations.
 * </p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    private String userId;
    private String email;
    private String username;

    private String firstName;
    private String lastName;
    private String phoneNumber;

    private String accountStatus;
    private String accountType;
    private List<String> roles;

    private AddressInfo address;
    private Preferences preferences;

    private LocalDateTime createdAt;
    private LocalDateTime lastLoginAt;
    private LocalDateTime updatedAt;

    private boolean emailVerified;
    private boolean phoneVerified;
    private boolean twoFactorEnabled;

    /**
     * Nested class for user address information.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AddressInfo {
        private String street;
        private String city;
        private String state;
        private String zipCode;
        private String country;
    }

    /**
     * Nested class for user preferences.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Preferences {
        private boolean marketingEmails;
        private boolean newsletterSubscription;
        private boolean smsNotifications;
        private String language;
        private String timezone;
        private String theme;
    }
}
