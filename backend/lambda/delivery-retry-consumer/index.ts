import { KafkaEvent } from 'aws-lambda';
import { updateDeliveryLog, moveToDeadLetterQueue, getDeliveryLogByDeliveryId } from '../../shared/models/deliveryLog';
import { publishMessage, parseMessage } from '../../shared/utils/kafka';
import { initializeDatabase } from '../../shared/utils/database';

/**
 * Lambda handler for delivery retry consumer
 *
 * Requirement 7: Delivery Retry process will consume the retry message
 * - 7a: Push the retry delivery message to delivery message store
 * - 7b: Push the failed message to delivery status checker system
 * - 7c: Update the webhook database with the failed delivery status
 */
export async function handler(event: KafkaEvent): Promise<void> {
  console.log('Delivery Retry Consumer Lambda invoked', {
    recordCount: event.records ? Object.keys(event.records).length : 0,
  });

  try {
    // Initialize database
    await initializeDatabase();

    // Process each Kafka record
    for (const topic in event.records) {
      for (const record of event.records[topic]) {
        await processRetryMessage(record);
      }
    }
  } catch (error) {
    console.error('Error in delivery retry consumer:', error);
    throw error; // Let Kafka retry
  }
}

/**
 * Process a single retry message
 */
async function processRetryMessage(record: any): Promise<void> {
  let retryMessage: any;

  try {
    // Parse Kafka message
    retryMessage = parseMessage(record);

    console.log('Processing retry message:', {
      deliveryId: retryMessage.deliveryId,
      eventId: retryMessage.eventId,
      subscriptionId: retryMessage.subscriptionId,
      retryAttempt: retryMessage.retryAttempt,
      nextRetryAt: retryMessage.nextRetryAt,
    });

    // Check if ready for retry based on nextRetryAt
    const now = new Date();
    const nextRetry = new Date(retryMessage.nextRetryAt);

    if (now < nextRetry) {
      // Not ready yet, skip (Kafka will re-deliver)
      console.log(`Not ready for retry yet. Next retry at: ${nextRetry.toISOString()}`);
      return;
    }

    // Check if still within retry limits
    if (retryMessage.retryAttempt >= retryMessage.maxRetries) {
      // Max retries exceeded
      console.error('Max retries exceeded. Moving to DLQ.');

      // Fetch delivery log
      const deliveryLog = await getDeliveryLogByDeliveryId(retryMessage.deliveryId);

      if (deliveryLog) {
        // Step 7c: Update the webhook database with failed status
        await updateDeliveryLog(retryMessage.deliveryId, {
          status: 'failed',
          error_message: retryMessage.lastError || 'Max retries exceeded',
          error_category: retryMessage.lastErrorCategory,
        });

        // Move to dead letter queue in database
        await moveToDeadLetterQueue(deliveryLog);

        // Step 7b: Push the failed message to delivery status checker
        await publishMessage(
          process.env.KAFKA_TOPIC_NOTIFICATIONS || 'status-notifications',
          {
            notificationType: 'delivery_permanently_failed',
            deliveryId: retryMessage.deliveryId,
            subscriptionId: retryMessage.subscriptionId,
            subscriberId: retryMessage.subscriberId,
            eventId: retryMessage.eventId,
            errorMessage: retryMessage.lastError,
            errorCategory: retryMessage.lastErrorCategory,
            totalAttempts: retryMessage.retryAttempt,
            timestamp: new Date().toISOString(),
          },
          retryMessage.deliveryId
        );

        console.log('Delivery moved to DLQ and notification sent');
      }

      return;
    }

    // Step 7a: Ready for retry - republish to delivery message store
    console.log(`Republishing to delivery-messages topic (attempt ${retryMessage.retryAttempt})...`);

    const deliveryMessage = {
      deliveryId: retryMessage.deliveryId,
      eventId: retryMessage.eventId,
      subscriptionId: retryMessage.subscriptionId,
      subscriberId: retryMessage.subscriberId,
      webhookUrl: retryMessage.webhookUrl,
      webhookSecret: retryMessage.webhookSecret,
      authType: retryMessage.authType,
      authConfig: retryMessage.authConfig,
      customHeaders: retryMessage.customHeaders,
      payload: retryMessage.payload,
      retryAttempt: retryMessage.retryAttempt,
      maxRetries: retryMessage.maxRetries,
      backoffStrategy: retryMessage.backoffStrategy,
      initialDelayMs: retryMessage.initialDelayMs,
      timeoutMs: retryMessage.timeoutMs,
      timestamp: new Date().toISOString(),
    };

    // Publish to delivery-messages topic
    await publishMessage(
      process.env.KAFKA_TOPIC_EVENTS || 'delivery-messages',
      deliveryMessage,
      retryMessage.deliveryId
    );

    console.log(`Retry ${retryMessage.retryAttempt} queued for delivery ${retryMessage.deliveryId}`);
  } catch (error: any) {
    console.error('Error processing retry message:', error);

    // Update delivery log with error if we have the delivery ID
    if (retryMessage?.deliveryId) {
      try {
        await updateDeliveryLog(retryMessage.deliveryId, {
          status: 'failed',
          error_message: `Retry processing error: ${error.message}`,
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
export { processRetryMessage };