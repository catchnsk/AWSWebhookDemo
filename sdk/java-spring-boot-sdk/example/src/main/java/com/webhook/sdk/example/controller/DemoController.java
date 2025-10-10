package com.webhook.sdk.example.controller;

import com.webhook.sdk.example.model.Order;
import com.webhook.sdk.example.model.User;
import com.webhook.sdk.example.service.OrderService;
import com.webhook.sdk.example.service.UserService;
import com.webhook.sdk.model.EventPublishResponse;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/**
 * REST controller providing demo endpoints to trigger webhook event publishing.
 * <p>
 * This controller provides endpoints that demonstrate various event publishing
 * patterns including synchronous, asynchronous, and batch operations.
 * </p>
 *
 * <h3>Available Endpoints:</h3>
 * <ul>
 *   <li>POST /demo/orders - Create order (sync publishing)</li>
 *   <li>POST /demo/orders/{id}/status - Update order status</li>
 *   <li>POST /demo/orders/{id}/cancel - Cancel order</li>
 *   <li>GET /demo/orders - List all orders</li>
 *   <li>POST /demo/users - Create user (async publishing)</li>
 *   <li>PUT /demo/users/{id} - Update user profile</li>
 *   <li>POST /demo/users/{id}/login - Record user login</li>
 *   <li>POST /demo/users/{id}/deactivate - Deactivate user</li>
 *   <li>GET /demo/users - List all users</li>
 *   <li>POST /demo/batch - Batch event publishing</li>
 *   <li>GET /demo/health - Health check</li>
 *   <li>POST /demo/sample-data - Generate sample data</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/demo")
public class DemoController {

    private final OrderService orderService;
    private final UserService userService;

    public DemoController(OrderService orderService, UserService userService) {
        this.orderService = orderService;
        this.userService = userService;
        log.info("DemoController initialized");
    }

    // ==================== Order Endpoints (Sync Publishing) ====================

    /**
     * Creates a new order with synchronous event publishing.
     * <p>
     * Example request:
     * <pre>
     * POST /api/demo/orders
     * {
     *   "customerEmail": "john.doe@example.com",
     *   "customerName": "John Doe",
     *   "items": [
     *     {
     *       "productName": "Laptop",
     *       "quantity": 1,
     *       "unitPrice": 999.99
     *     }
     *   ]
     * }
     * </pre>
     * </p>
     */
    @PostMapping("/orders")
    public ResponseEntity<ApiResponse<Order>> createOrder(@RequestBody CreateOrderRequest request) {
        log.info("Received create order request for: {}", request.getCustomerEmail());

        try {
            // Build order from request
            Order order = buildOrderFromRequest(request);

            // Create order (publishes event synchronously)
            Order createdOrder = orderService.createOrder(order);

            return ResponseEntity.ok(ApiResponse.success(createdOrder,
                "Order created successfully. Event published synchronously."));

        } catch (Exception e) {
            log.error("Failed to create order: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to create order: " + e.getMessage()));
        }
    }

    /**
     * Updates order status with synchronous event publishing.
     */
    @PostMapping("/orders/{orderId}/status")
    public ResponseEntity<ApiResponse<Order>> updateOrderStatus(
        @PathVariable String orderId,
        @RequestBody UpdateStatusRequest request) {

        log.info("Updating order status: {} -> {}", orderId, request.getNewStatus());

        try {
            Order updatedOrder = orderService.updateOrderStatus(orderId, request.getNewStatus());
            return ResponseEntity.ok(ApiResponse.success(updatedOrder,
                "Order status updated. Event published synchronously."));

        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Order not found: " + orderId));
        } catch (Exception e) {
            log.error("Failed to update order status: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to update order status: " + e.getMessage()));
        }
    }

    /**
     * Cancels an order with synchronous event publishing.
     */
    @PostMapping("/orders/{orderId}/cancel")
    public ResponseEntity<ApiResponse<Order>> cancelOrder(
        @PathVariable String orderId,
        @RequestBody CancelOrderRequest request) {

        log.info("Cancelling order: {}", orderId);

        try {
            Order cancelledOrder = orderService.cancelOrder(orderId, request.getReason());
            return ResponseEntity.ok(ApiResponse.success(cancelledOrder,
                "Order cancelled. Event published synchronously."));

        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Order not found: " + orderId));
        } catch (Exception e) {
            log.error("Failed to cancel order: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to cancel order: " + e.getMessage()));
        }
    }

    /**
     * Lists all orders.
     */
    @GetMapping("/orders")
    public ResponseEntity<ApiResponse<List<Order>>> getAllOrders() {
        List<Order> orders = orderService.getAllOrders();
        return ResponseEntity.ok(ApiResponse.success(orders,
            "Retrieved " + orders.size() + " orders"));
    }

    // ==================== User Endpoints (Async Publishing) ====================

    /**
     * Creates a new user with asynchronous event publishing.
     * <p>
     * Example request:
     * <pre>
     * POST /api/demo/users
     * {
     *   "email": "jane.smith@example.com",
     *   "username": "janesmith",
     *   "firstName": "Jane",
     *   "lastName": "Smith"
     * }
     * </pre>
     * </p>
     */
    @PostMapping("/users")
    public ResponseEntity<ApiResponse<User>> createUser(@RequestBody CreateUserRequest request) {
        log.info("Received create user request for: {}", request.getEmail());

        try {
            // Build user from request
            User user = buildUserFromRequest(request);

            // Create user (publishes event asynchronously)
            User createdUser = userService.createUser(user);

            return ResponseEntity.ok(ApiResponse.success(createdUser,
                "User created successfully. Event published asynchronously."));

        } catch (Exception e) {
            log.error("Failed to create user: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to create user: " + e.getMessage()));
        }
    }

    /**
     * Updates user profile with asynchronous event publishing.
     */
    @PutMapping("/users/{userId}")
    public ResponseEntity<ApiResponse<User>> updateUser(
        @PathVariable String userId,
        @RequestBody Map<String, Object> updates) {

        log.info("Updating user: {}", userId);

        try {
            User updatedUser = userService.updateUserProfile(userId, updates);
            return ResponseEntity.ok(ApiResponse.success(updatedUser,
                "User updated. Event published asynchronously."));

        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("User not found: " + userId));
        } catch (Exception e) {
            log.error("Failed to update user: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to update user: " + e.getMessage()));
        }
    }

    /**
     * Records user login with asynchronous event publishing.
     */
    @PostMapping("/users/{userId}/login")
    public ResponseEntity<ApiResponse<String>> recordLogin(
        @PathVariable String userId,
        @RequestBody LoginRequest request) {

        log.info("Recording login for user: {}", userId);

        try {
            userService.recordUserLogin(userId, request.getIpAddress(), request.getUserAgent());
            return ResponseEntity.ok(ApiResponse.success("Login recorded",
                "Login event published asynchronously."));

        } catch (Exception e) {
            log.error("Failed to record login: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to record login: " + e.getMessage()));
        }
    }

    /**
     * Deactivates a user with asynchronous event publishing.
     */
    @PostMapping("/users/{userId}/deactivate")
    public ResponseEntity<ApiResponse<User>> deactivateUser(
        @PathVariable String userId,
        @RequestBody DeactivateUserRequest request) {

        log.info("Deactivating user: {}", userId);

        try {
            User deactivatedUser = userService.deactivateUser(userId, request.getReason());
            return ResponseEntity.ok(ApiResponse.success(deactivatedUser,
                "User deactivated. Event published asynchronously."));

        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("User not found: " + userId));
        } catch (Exception e) {
            log.error("Failed to deactivate user: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to deactivate user: " + e.getMessage()));
        }
    }

    /**
     * Lists all users.
     */
    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<User>>> getAllUsers() {
        List<User> users = userService.getAllUsers();
        return ResponseEntity.ok(ApiResponse.success(users,
            "Retrieved " + users.size() + " users"));
    }

    // ==================== Batch Operations ====================

    /**
     * Demonstrates batch event publishing by creating multiple users.
     */
    @PostMapping("/batch")
    public ResponseEntity<ApiResponse<BatchResult>> batchPublish(@RequestBody BatchRequest request) {
        log.info("Processing batch event publish request for {} users", request.getCount());

        try {
            List<User> users = new ArrayList<>();
            for (int i = 0; i < request.getCount(); i++) {
                User user = User.builder()
                    .userId(UUID.randomUUID().toString())
                    .email("user" + i + "@example.com")
                    .username("user" + i)
                    .firstName("User")
                    .lastName("" + i)
                    .accountStatus("ACTIVE")
                    .accountType("STANDARD")
                    .roles(List.of("USER"))
                    .emailVerified(false)
                    .phoneVerified(false)
                    .twoFactorEnabled(false)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
                users.add(user);
            }

            CompletableFuture<EventPublishResponse[]> future = userService.publishBatchUserEvents(users);

            // Wait for completion (in production, you might return immediately)
            EventPublishResponse[] responses = future.get();

            BatchResult result = new BatchResult();
            result.setTotalRequested(request.getCount());
            result.setSuccessCount(responses.length);
            result.setFailureCount(request.getCount() - responses.length);

            return ResponseEntity.ok(ApiResponse.success(result,
                "Batch events published asynchronously."));

        } catch (Exception e) {
            log.error("Failed to publish batch events: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to publish batch events: " + e.getMessage()));
        }
    }

    // ==================== Utility Endpoints ====================

    /**
     * Health check endpoint.
     */
    @GetMapping("/health")
    public ResponseEntity<ApiResponse<Map<String, String>>> healthCheck() {
        Map<String, String> health = new HashMap<>();
        health.put("status", "UP");
        health.put("timestamp", LocalDateTime.now().toString());
        health.put("service", "Webhook SDK Example");
        return ResponseEntity.ok(ApiResponse.success(health, "Service is healthy"));
    }

    /**
     * Generates sample data for testing.
     */
    @PostMapping("/sample-data")
    public ResponseEntity<ApiResponse<Map<String, Object>>> generateSampleData() {
        log.info("Generating sample data");

        try {
            // Create sample user
            User sampleUser = User.builder()
                .email("demo.user@example.com")
                .username("demouser")
                .firstName("Demo")
                .lastName("User")
                .phoneNumber("+1-555-0100")
                .accountType("PREMIUM")
                .roles(List.of("USER", "ADMIN"))
                .emailVerified(true)
                .phoneVerified(true)
                .twoFactorEnabled(false)
                .address(User.AddressInfo.builder()
                    .street("123 Demo Street")
                    .city("San Francisco")
                    .state("CA")
                    .zipCode("94102")
                    .country("USA")
                    .build())
                .preferences(User.Preferences.builder()
                    .marketingEmails(true)
                    .newsletterSubscription(true)
                    .smsNotifications(false)
                    .language("en")
                    .timezone("America/Los_Angeles")
                    .theme("dark")
                    .build())
                .build();

            User createdUser = userService.createUser(sampleUser);

            // Create sample order
            Order sampleOrder = Order.builder()
                .customerId(createdUser.getUserId())
                .customerEmail(createdUser.getEmail())
                .customerName(createdUser.getFirstName() + " " + createdUser.getLastName())
                .items(List.of(
                    Order.OrderItem.builder()
                        .productId("PROD-001")
                        .productName("Premium Laptop")
                        .sku("LAP-PREM-001")
                        .quantity(1)
                        .unitPrice(new BigDecimal("1299.99"))
                        .totalPrice(new BigDecimal("1299.99"))
                        .category("Electronics")
                        .build(),
                    Order.OrderItem.builder()
                        .productId("PROD-002")
                        .productName("Wireless Mouse")
                        .sku("MOU-WIRE-002")
                        .quantity(2)
                        .unitPrice(new BigDecimal("29.99"))
                        .totalPrice(new BigDecimal("59.98"))
                        .category("Accessories")
                        .build()
                ))
                .subtotal(new BigDecimal("1359.97"))
                .tax(new BigDecimal("108.80"))
                .shipping(new BigDecimal("15.00"))
                .total(new BigDecimal("1483.77"))
                .currency("USD")
                .paymentMethod("credit_card")
                .paymentStatus("PAID")
                .shippingAddress("123 Demo Street, San Francisco, CA 94102")
                .billingAddress("123 Demo Street, San Francisco, CA 94102")
                .build();

            Order createdOrder = orderService.createOrder(sampleOrder);

            Map<String, Object> result = new HashMap<>();
            result.put("user", createdUser);
            result.put("order", createdOrder);

            return ResponseEntity.ok(ApiResponse.success(result,
                "Sample data generated successfully"));

        } catch (Exception e) {
            log.error("Failed to generate sample data: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to generate sample data: " + e.getMessage()));
        }
    }

    // ==================== Helper Methods ====================

    private Order buildOrderFromRequest(CreateOrderRequest request) {
        BigDecimal subtotal = BigDecimal.ZERO;
        List<Order.OrderItem> items = new ArrayList<>();

        for (CreateOrderRequest.ItemRequest itemReq : request.getItems()) {
            BigDecimal itemTotal = itemReq.getUnitPrice().multiply(new BigDecimal(itemReq.getQuantity()));
            subtotal = subtotal.add(itemTotal);

            items.add(Order.OrderItem.builder()
                .productId(itemReq.getProductId() != null ? itemReq.getProductId() : UUID.randomUUID().toString())
                .productName(itemReq.getProductName())
                .sku(itemReq.getSku() != null ? itemReq.getSku() : "SKU-" + UUID.randomUUID().toString().substring(0, 8))
                .quantity(itemReq.getQuantity())
                .unitPrice(itemReq.getUnitPrice())
                .totalPrice(itemTotal)
                .category(itemReq.getCategory() != null ? itemReq.getCategory() : "General")
                .build());
        }

        BigDecimal tax = subtotal.multiply(new BigDecimal("0.08")); // 8% tax
        BigDecimal shipping = new BigDecimal("10.00");
        BigDecimal total = subtotal.add(tax).add(shipping);

        return Order.builder()
            .customerId(request.getCustomerId() != null ? request.getCustomerId() : UUID.randomUUID().toString())
            .customerEmail(request.getCustomerEmail())
            .customerName(request.getCustomerName())
            .items(items)
            .subtotal(subtotal)
            .tax(tax)
            .shipping(shipping)
            .total(total)
            .currency("USD")
            .paymentMethod(request.getPaymentMethod() != null ? request.getPaymentMethod() : "credit_card")
            .paymentStatus("PAID")
            .shippingAddress(request.getShippingAddress() != null ? request.getShippingAddress() : "123 Main St, City, State 12345")
            .billingAddress(request.getBillingAddress() != null ? request.getBillingAddress() : request.getShippingAddress())
            .build();
    }

    private User buildUserFromRequest(CreateUserRequest request) {
        return User.builder()
            .email(request.getEmail())
            .username(request.getUsername())
            .firstName(request.getFirstName())
            .lastName(request.getLastName())
            .phoneNumber(request.getPhoneNumber())
            .accountType(request.getAccountType() != null ? request.getAccountType() : "STANDARD")
            .roles(request.getRoles() != null ? request.getRoles() : List.of("USER"))
            .emailVerified(false)
            .phoneVerified(false)
            .twoFactorEnabled(false)
            .build();
    }

    // ==================== Request/Response DTOs ====================

    @Data
    static class CreateOrderRequest {
        private String customerId;
        private String customerEmail;
        private String customerName;
        private List<ItemRequest> items;
        private String paymentMethod;
        private String shippingAddress;
        private String billingAddress;

        @Data
        static class ItemRequest {
            private String productId;
            private String productName;
            private String sku;
            private Integer quantity;
            private BigDecimal unitPrice;
            private String category;
        }
    }

    @Data
    static class UpdateStatusRequest {
        private String newStatus;
    }

    @Data
    static class CancelOrderRequest {
        private String reason;
    }

    @Data
    static class CreateUserRequest {
        private String email;
        private String username;
        private String firstName;
        private String lastName;
        private String phoneNumber;
        private String accountType;
        private List<String> roles;
    }

    @Data
    static class LoginRequest {
        private String ipAddress;
        private String userAgent;
    }

    @Data
    static class DeactivateUserRequest {
        private String reason;
    }

    @Data
    static class BatchRequest {
        private Integer count = 5;
    }

    @Data
    static class BatchResult {
        private Integer totalRequested;
        private Integer successCount;
        private Integer failureCount;
    }

    @Data
    static class ApiResponse<T> {
        private boolean success;
        private String message;
        private T data;
        private String timestamp;

        static <T> ApiResponse<T> success(T data, String message) {
            ApiResponse<T> response = new ApiResponse<>();
            response.setSuccess(true);
            response.setMessage(message);
            response.setData(data);
            response.setTimestamp(LocalDateTime.now().toString());
            return response;
        }

        static <T> ApiResponse<T> error(String message) {
            ApiResponse<T> response = new ApiResponse<>();
            response.setSuccess(false);
            response.setMessage(message);
            response.setTimestamp(LocalDateTime.now().toString());
            return response;
        }
    }
}
