package com.webhook.sdk.example.service;

import com.webhook.sdk.client.WebhookEventPublisherClient;
import com.webhook.sdk.example.model.Order;
import com.webhook.sdk.model.EventPublishRequest;
import com.webhook.sdk.model.EventPublishResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Service class demonstrating SYNCHRONOUS event publishing for critical operations.
 * <p>
 * Order operations are business-critical and require immediate confirmation that
 * events are successfully published to the webhook system. This service uses
 * synchronous publishing with retry logic to ensure reliability.
 * </p>
 *
 * <h3>Key Features Demonstrated:</h3>
 * <ul>
 *   <li>Synchronous event publishing for critical operations</li>
 *   <li>Retry logic for failed publishes</li>
 *   <li>Comprehensive error handling</li>
 *   <li>Transaction-aware event publishing</li>
 *   <li>Detailed logging for debugging</li>
 * </ul>
 *
 * @see WebhookEventPublisherClient#publishEvent
 * @see WebhookEventPublisherClient#publishEventWithRetry
 */
@Slf4j
@Service
public class OrderService {

    private final WebhookEventPublisherClient webhookClient;

    // In-memory storage for demo purposes
    private final Map<String, Order> orderStorage = new HashMap<>();

    public OrderService(WebhookEventPublisherClient webhookClient) {
        this.webhookClient = webhookClient;
        log.info("OrderService initialized with WebhookEventPublisherClient");
    }

    /**
     * Creates a new order and publishes an order.created event synchronously.
     * <p>
     * This method demonstrates synchronous event publishing for critical operations.
     * The order is only saved if the event is successfully published, ensuring
     * data consistency between your system and the webhook subscribers.
     * </p>
     *
     * @param order the order to create
     * @return the created order with generated ID and timestamps
     * @throws RuntimeException if event publishing fails after retries
     */
    public Order createOrder(Order order) {
        log.info("Creating new order for customer: {}", order.getCustomerEmail());

        // Generate order ID and timestamps
        order.setOrderId(UUID.randomUUID().toString());
        order.setCreatedAt(LocalDateTime.now());
        order.setUpdatedAt(LocalDateTime.now());
        order.setStatus("PENDING");

        try {
            // Build event payload from order data
            Map<String, Object> payload = buildOrderPayload(order);

            // Create event publish request
            EventPublishRequest eventRequest = EventPublishRequest.builder()
                .eventType("order.created")
                .schemaId("order-schema-v1")
                .payload(payload)
                .build();

            log.debug("Publishing order.created event for order: {}", order.getOrderId());

            // Publish event synchronously with retry logic
            // Using retry ensures reliability for critical operations
            EventPublishResponse response = webhookClient.publishEventWithRetry(eventRequest, 3);

            log.info("Successfully published order.created event - EventID: {}, OrderID: {}",
                response.getEventId(), order.getOrderId());

            // Save order only after successful event publication
            orderStorage.put(order.getOrderId(), order);

            log.info("Order created successfully: {}", order.getOrderId());
            return order;

        } catch (Exception e) {
            log.error("Failed to publish order.created event for order: {}. Error: {}",
                order.getOrderId(), e.getMessage(), e);

            // In a production system, you might:
            // 1. Roll back the transaction
            // 2. Queue the event for later retry
            // 3. Send alert to operations team
            // 4. Return error to user

            throw new RuntimeException("Failed to create order due to event publishing failure: " + e.getMessage(), e);
        }
    }

    /**
     * Updates an order status and publishes an order.status_changed event.
     * <p>
     * Demonstrates synchronous publishing for state changes that subscribers
     * need to be immediately notified about.
     * </p>
     *
     * @param orderId   the order ID
     * @param newStatus the new order status
     * @return the updated order
     * @throws NoSuchElementException if order not found
     */
    public Order updateOrderStatus(String orderId, String newStatus) {
        log.info("Updating order status: {} -> {}", orderId, newStatus);

        Order order = orderStorage.get(orderId);
        if (order == null) {
            throw new NoSuchElementException("Order not found: " + orderId);
        }

        String oldStatus = order.getStatus();
        order.setStatus(newStatus);
        order.setUpdatedAt(LocalDateTime.now());

        try {
            // Build status change event payload
            Map<String, Object> payload = new HashMap<>();
            payload.put("orderId", orderId);
            payload.put("customerId", order.getCustomerId());
            payload.put("oldStatus", oldStatus);
            payload.put("newStatus", newStatus);
            payload.put("updatedAt", order.getUpdatedAt().toString());
            payload.put("total", order.getTotal().toString());
            payload.put("currency", order.getCurrency());

            EventPublishRequest eventRequest = EventPublishRequest.builder()
                .eventType("order.status_changed")
                .schemaId("order-status-schema-v1")
                .payload(payload)
                .build();

            // Publish synchronously - critical for status updates
            EventPublishResponse response = webhookClient.publishEvent(eventRequest);

            log.info("Published order.status_changed event - EventID: {}", response.getEventId());

            return order;

        } catch (Exception e) {
            // Revert status change on publish failure
            order.setStatus(oldStatus);

            log.error("Failed to publish order.status_changed event. Status reverted. Error: {}",
                e.getMessage(), e);

            throw new RuntimeException("Failed to update order status: " + e.getMessage(), e);
        }
    }

    /**
     * Cancels an order and publishes an order.cancelled event.
     *
     * @param orderId the order ID to cancel
     * @param reason  the cancellation reason
     * @return the cancelled order
     */
    public Order cancelOrder(String orderId, String reason) {
        log.info("Cancelling order: {} - Reason: {}", orderId, reason);

        Order order = orderStorage.get(orderId);
        if (order == null) {
            throw new NoSuchElementException("Order not found: " + orderId);
        }

        if ("CANCELLED".equals(order.getStatus())) {
            log.warn("Order already cancelled: {}", orderId);
            return order;
        }

        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("orderId", orderId);
            payload.put("customerId", order.getCustomerId());
            payload.put("customerEmail", order.getCustomerEmail());
            payload.put("previousStatus", order.getStatus());
            payload.put("cancelledAt", LocalDateTime.now().toString());
            payload.put("reason", reason);
            payload.put("refundAmount", order.getTotal().toString());
            payload.put("currency", order.getCurrency());

            EventPublishRequest eventRequest = EventPublishRequest.builder()
                .eventType("order.cancelled")
                .schemaId("order-cancelled-schema-v1")
                .payload(payload)
                .build();

            EventPublishResponse response = webhookClient.publishEventWithRetry(eventRequest, 3);

            log.info("Published order.cancelled event - EventID: {}", response.getEventId());

            // Update order status
            order.setStatus("CANCELLED");
            order.setUpdatedAt(LocalDateTime.now());

            return order;

        } catch (Exception e) {
            log.error("Failed to cancel order: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to cancel order: " + e.getMessage(), e);
        }
    }

    /**
     * Retrieves an order by ID.
     *
     * @param orderId the order ID
     * @return the order
     */
    public Optional<Order> getOrder(String orderId) {
        return Optional.ofNullable(orderStorage.get(orderId));
    }

    /**
     * Lists all orders.
     *
     * @return list of all orders
     */
    public List<Order> getAllOrders() {
        return new ArrayList<>(orderStorage.values());
    }

    /**
     * Builds the event payload from an order object.
     *
     * @param order the order
     * @return the event payload map
     */
    private Map<String, Object> buildOrderPayload(Order order) {
        Map<String, Object> payload = new HashMap<>();

        // Order identification
        payload.put("orderId", order.getOrderId());
        payload.put("customerId", order.getCustomerId());
        payload.put("customerEmail", order.getCustomerEmail());
        payload.put("customerName", order.getCustomerName());

        // Order items
        List<Map<String, Object>> itemsList = new ArrayList<>();
        for (Order.OrderItem item : order.getItems()) {
            Map<String, Object> itemMap = new HashMap<>();
            itemMap.put("productId", item.getProductId());
            itemMap.put("productName", item.getProductName());
            itemMap.put("sku", item.getSku());
            itemMap.put("quantity", item.getQuantity());
            itemMap.put("unitPrice", item.getUnitPrice().toString());
            itemMap.put("totalPrice", item.getTotalPrice().toString());
            itemMap.put("category", item.getCategory());
            itemsList.add(itemMap);
        }
        payload.put("items", itemsList);

        // Pricing
        payload.put("subtotal", order.getSubtotal().toString());
        payload.put("tax", order.getTax().toString());
        payload.put("shipping", order.getShipping().toString());
        payload.put("total", order.getTotal().toString());
        payload.put("currency", order.getCurrency());

        // Payment
        payload.put("paymentMethod", order.getPaymentMethod());
        payload.put("paymentStatus", order.getPaymentStatus());

        // Addresses
        payload.put("shippingAddress", order.getShippingAddress());
        payload.put("billingAddress", order.getBillingAddress());

        // Metadata
        payload.put("status", order.getStatus());
        payload.put("createdAt", order.getCreatedAt().toString());
        payload.put("updatedAt", order.getUpdatedAt().toString());

        return payload;
    }
}
