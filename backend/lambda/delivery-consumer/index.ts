import { KafkaEvent } from 'aws-lambda';
import { updateDeliveryLog } from '../../shared/models/deliveryLog';
import { updateEventMessageDeliveryCounts } from '../../shared/models/eventMessage';
import { updateSubscriberDeliveryStats } from '../../shared/models/subscriber';
import { sendWebhook, calculateNextRetryAt, isRetryableError } from '../../shared/utils/egressGateway';
import { publishMessage, parseMessage } from '../../shared/utils/kafka';
import { initializeDatabase } from '../../shared/utils/database';

/**
 * Lambda handler for delivery consumer
 *
 * Requirement 6: The message will be consumed by the delivery process
 * - 6a: If there is a failure, send to Retry message store
 * - 6b: Update the delivery status in database
 * - 6c: Send the message to Egress Gateway
 */
export async function handler(event: KafkaEvent): Promise<void> {
  console.log('Delivery Consumer Lambda invoked', {
    recordCount: event.records ? Object.keys(event.records).length : 0,
  });

  try {
    // Initialize database
    await initializeDatabase();

    // Process each Kafka record
    for (const topic in event.records) {
      for (const record of event.records[topic]) {
        await processDeliveryMessage(record);
      }
    }
  } catch (error) {
    console.error('Error in delivery consumer:', error);
    throw error; // Let Kafka retry
  }
}

/**
 * Process a single delivery message
 */
async function processDeliveryMessage(record: any): Promise<void> {
  let deliveryMessage: any;

  try {
    // Parse Kafka message
    deliveryMessage = parseMessage(record);

    console.log('Processing delivery:', {
      deliveryId: deliveryMessage.deliveryId,
      eventId: deliveryMessage.eventId,
      subscriptionId: deliveryMessage.subscriptionId,
      retryAttempt: deliveryMessage.retryAttempt,
    });

    // Update delivery log status to "delivering"
    await updateDeliveryLog(deliveryMessage.deliveryId, {
      status: 'delivering',
    });

    // Step 1: Send webhook via Egress Gateway
    console.log('Sending webhook to:', deliveryMessage.webhookUrl);
    const startTime = Date.now();

    const result = await sendWebhook({
      url: deliveryMessage.webhookUrl,
      payload: deliveryMessage.payload,
      method: 'POST',
      secret: deliveryMessage.webhookSecret,
      headers: deliveryMessage.customHeaders,
      timeout: deliveryMessage.timeoutMs,
      authType: deliveryMessage.authType,
      authConfig: deliveryMessage.authConfig,
    });

    const deliveredAt = new Date();

    // Step 2: Handle delivery result
    if (result.success) {
      // SUCCESS: Update delivery log
      console.log('Delivery successful:', {
        deliveryId: deliveryMessage.deliveryId,
        statusCode: result.statusCode,
        latency: result.latency,
      });

      await updateDeliveryLog(deliveryMessage.deliveryId, {
        status: 'success',
        response_status_code: result.statusCode,
        response_headers: result.headers,
        response_body: result.body,
        latency_ms: result.latency,
        delivered_at: deliveredAt,
      });

      // Update event message delivery count
      await updateEventMessageDeliveryCounts(deliveryMessage.eventId, {
        deliveries_completed: 1,
      });

      // Update subscriber statistics
      await updateSubscriberDeliveryStats(deliveryMessage.subscriberId, true);

      console.log('Delivery completed successfully');
    } else {
      // FAILURE: Determine if should retry
      console.error('Delivery failed:', {
        deliveryId: deliveryMessage.deliveryId,
        error: result.error,
        errorCategory: result.errorCategory,
        statusCode: result.statusCode,
      });

      const shouldRetry = isRetryableError(result.errorCategory, result.statusCode);
      const hasRetriesLeft = deliveryMessage.retryAttempt < deliveryMessage.maxRetries;

      if (shouldRetry && hasRetriesLeft) {
        // Step 3a: Publish to Retry Message Store
        console.log('Queueing for retry...');

        const nextRetryAt = calculateNextRetryAt(
          deliveryMessage.retryAttempt,
          deliveryMessage.backoffStrategy,
          deliveryMessage.initialDelayMs
        );

        const retryMessage = {
          ...deliveryMessage,
          retryAttempt: deliveryMessage.retryAttempt + 1,
          lastError: result.error,
          lastErrorCategory: result.errorCategory,
          nextRetryAt: nextRetryAt.toISOString(),
        };

        // Publish to retry topic
        await publishMessage(
          process.env.KAFKA_TOPIC_RETRY || 'retry-messages',
          retryMessage,
          deliveryMessage.deliveryId
        );

        // Update delivery log
        await updateDeliveryLog(deliveryMessage.deliveryId, {
          status: 'retrying',
          response_status_code: result.statusCode,
          response_body: result.body,
          latency_ms: result.latency,
          error_message: result.error,
          error_category: result.errorCategory,
          next_retry_at: nextRetryAt,
        });

        // Step 3a.2: Notify delivery status checker
        await publishMessage(
          process.env.KAFKA_TOPIC_NOTIFICATIONS || 'status-notifications',
          {
            notificationType: 'delivery_failed',
            deliveryId: deliveryMessage.deliveryId,
            subscriptionId: deliveryMessage.subscriptionId,
            subscriberId: deliveryMessage.subscriberId,
            eventId: deliveryMessage.eventId,
            errorMessage: result.error,
            errorCategory: result.errorCategory,
            retryAttempt: deliveryMessage.retryAttempt,
            nextRetryAt: nextRetryAt.toISOString(),
            timestamp: new Date().toISOString(),
          },
          deliveryMessage.deliveryId
        );

        console.log(`Retry scheduled for ${nextRetryAt.toISOString()}`);
      } else {
        // Max retries reached or non-retryable error
        console.error('Max retries reached or non-retryable error. Moving to DLQ.');

        // Update delivery log to failed
        await updateDeliveryLog(deliveryMessage.deliveryId, {
          status: 'failed',
          response_status_code: result.statusCode,
          response_body: result.body,
          latency_ms: result.latency,
          error_message: result.error,
          error_category: result.errorCategory,
          delivered_at: deliveredAt,
        });

        // Update event message delivery count
        await updateEventMessageDeliveryCounts(deliveryMessage.eventId, {
          deliveries_failed: 1,
        });

        // Update subscriber statistics
        await updateSubscriberDeliveryStats(deliveryMessage.subscriberId, false);

        // Publish to DLQ topic
        await publishMessage(
          process.env.KAFKA_TOPIC_DLQ || 'dlq-messages',
          {
            ...deliveryMessage,
            finalError: result.error,
            finalErrorCategory: result.errorCategory,
            totalAttempts: deliveryMessage.retryAttempt + 1,
            timestamp: new Date().toISOString(),
          },
          deliveryMessage.deliveryId
        );

        // Notify delivery status checker of permanent failure
        await publishMessage(
          process.env.KAFKA_TOPIC_NOTIFICATIONS || 'status-notifications',
          {
            notificationType: 'delivery_permanently_failed',
            deliveryId: deliveryMessage.deliveryId,
            subscriptionId: deliveryMessage.subscriptionId,
            subscriberId: deliveryMessage.subscriberId,
            eventId: deliveryMessage.eventId,
            errorMessage: result.error,
            errorCategory: result.errorCategory,
            totalAttempts: deliveryMessage.retryAttempt + 1,
            timestamp: new Date().toISOString(),
          },
          deliveryMessage.deliveryId
        );

        console.log('Delivery permanently failed and moved to DLQ');
      }
    }
  } catch (error: any) {
    console.error('Error processing delivery message:', error);

    // Update delivery log with error if we have the delivery ID
    if (deliveryMessage?.deliveryId) {
      try {
        await updateDeliveryLog(deliveryMessage.deliveryId, {
          status: 'failed',
          error_message: error.message,
          error_category: 'validation',
        });
      } catch (updateError) {
        console.error('Failed to update delivery log:', updateError);
      }
    }

    // Re-throw to let Kafka retry
    throw error;
  }
}

/**
 * Export for testing
 */
export { processDeliveryMessage };