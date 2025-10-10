package com.webhook.sdk.example.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Domain model representing an Order in the example application.
 * <p>
 * This model is used to demonstrate synchronous event publishing
 * for critical business operations.
 * </p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Order {

    private String orderId;
    private String customerId;
    private String customerEmail;
    private String customerName;

    private List<OrderItem> items;

    private BigDecimal subtotal;
    private BigDecimal tax;
    private BigDecimal shipping;
    private BigDecimal total;

    private String currency;
    private String paymentMethod;
    private String paymentStatus;

    private String shippingAddress;
    private String billingAddress;

    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /**
     * Nested class representing an order item.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderItem {
        private String productId;
        private String productName;
        private String sku;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal totalPrice;
        private String category;
    }
}
