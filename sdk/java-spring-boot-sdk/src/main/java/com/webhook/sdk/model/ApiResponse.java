package com.webhook.sdk.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Generic API response wrapper for consistent response formatting.
 * <p>
 * This class provides a standardized structure for API responses, wrapping
 * the actual response data along with status information and optional error details.
 * </p>
 *
 * @param <T> the type of the response data
 * @author Webhook SDK Team
 * @version 1.0
 * @since 1.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {

    /**
     * Indicates whether the API call was successful.
     */
    private boolean success;

    /**
     * The actual response data.
     * <p>
     * Will be null if the operation failed or returned no data.
     * </p>
     */
    private T data;

    /**
     * A descriptive message about the operation.
     * <p>
     * Provides additional context about the success or failure of the operation.
     * </p>
     */
    private String message;

    /**
     * Error code if the operation failed.
     * <p>
     * Contains a machine-readable error identifier for failed operations.
     * Will be null for successful operations.
     * </p>
     */
    private String errorCode;

    /**
     * Creates a successful API response with data.
     *
     * @param data the response data
     * @param <T>  the type of the response data
     * @return a successful ApiResponse containing the provided data
     */
    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .data(data)
                .message("Operation completed successfully")
                .build();
    }

    /**
     * Creates a successful API response with data and custom message.
     *
     * @param data    the response data
     * @param message the success message
     * @param <T>     the type of the response data
     * @return a successful ApiResponse containing the provided data and message
     */
    public static <T> ApiResponse<T> success(T data, String message) {
        return ApiResponse.<T>builder()
                .success(true)
                .data(data)
                .message(message)
                .build();
    }

    /**
     * Creates a failed API response with error details.
     *
     * @param message   the error message
     * @param errorCode the error code
     * @param <T>       the type of the response data
     * @return a failed ApiResponse with error information
     */
    public static <T> ApiResponse<T> error(String message, String errorCode) {
        return ApiResponse.<T>builder()
                .success(false)
                .message(message)
                .errorCode(errorCode)
                .build();
    }

    /**
     * Creates a failed API response with only an error message.
     *
     * @param message the error message
     * @param <T>     the type of the response data
     * @return a failed ApiResponse with error message
     */
    public static <T> ApiResponse<T> error(String message) {
        return ApiResponse.<T>builder()
                .success(false)
                .message(message)
                .build();
    }
}
