import * as dotenv from 'dotenv';
import { KafkaEvent } from 'aws-lambda';
import { subscribe } from './shared/utils/kafka';

// Load environment variables
dotenv.config();

// Import Lambda handlers
import { handler as deliveryRetryConsumerHandler } from './lambda/delivery-retry-consumer/index';

/**
 * Convert Kafka message to Lambda KafkaEvent format
 */
function createKafkaEvent(topic: string, messages: any[]): KafkaEvent {
  return {
    eventSource: 'aws:kafka',
    eventSourceArn: `local-kafka-${topic}`,
    records: {
      [topic]: messages.map((msg: any) => ({
        topic,
        partition: msg.partition,
        offset: msg.offset,
        timestamp: msg.timestamp,
        timestampType: 'CREATE_TIME',
        key: msg.key ? msg.key.toString() : null,
        value: msg.value.toString(),
        headers: msg.headers || [],
      })),
    },
  };
}

/**
 * Start Delivery Retry Consumer
 */
async function startRetryConsumer() {
  console.log('🚀 Starting Delivery Retry Consumer...');
  console.log('================================================');
  console.log(`📨 Kafka Brokers: ${process.env.KAFKA_BROKERS}`);
  console.log(`📬 Consuming from: ${process.env.KAFKA_TOPIC_RETRY}`);
  console.log('');

  await subscribe(
    process.env.KAFKA_TOPIC_RETRY || 'retry-messages',
    `${process.env.KAFKA_GROUP_ID}-retry` || 'webhook-consumers-local-retry',
    async ({ topic, partition, message }) => {
      console.log(`📩 Received retry message from ${topic} [partition ${partition}]`);

      try {
        // Convert to Lambda event format
        const event = createKafkaEvent(topic, [
          {
            partition,
            offset: message.offset,
            timestamp: message.timestamp,
            key: message.key,
            value: message.value,
            headers: message.headers,
          },
        ]);

        // Invoke Lambda handler
        await deliveryRetryConsumerHandler(event);

        console.log(`✅ Retry message processed successfully`);
      } catch (error: any) {
        console.error(`❌ Error processing retry message:`, error.message);
        // In production, Kafka would retry based on configuration
      }
    }
  );

  console.log('✅ Delivery Retry Consumer started successfully!');
  console.log('   Waiting for retry messages...\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down retry consumer...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down retry consumer...');
  process.exit(0);
});

// Start the consumer
startRetryConsumer().catch((error) => {
  console.error('❌ Failed to start retry consumer:', error);
  process.exit(1);
});
