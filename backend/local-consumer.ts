import * as dotenv from 'dotenv';
import { KafkaEvent } from 'aws-lambda';
import { subscribe } from './shared/utils/kafka';

// Load environment variables
dotenv.config();

// Import Lambda handlers
import { handler as deliveryConsumerHandler } from './lambda/delivery-consumer/index';

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
 * Start Delivery Consumer
 */
async function startDeliveryConsumer() {
  console.log('🚀 Starting Delivery Consumer...');
  console.log('================================================');
  console.log(`📨 Kafka Brokers: ${process.env.KAFKA_BROKERS}`);
  console.log(`📬 Consuming from: ${process.env.KAFKA_TOPIC_EVENTS}`);
  console.log('');

  await subscribe(
    process.env.KAFKA_TOPIC_EVENTS || 'delivery-messages',
    process.env.KAFKA_GROUP_ID || 'webhook-consumers-local',
    async ({ topic, partition, message }) => {
      console.log(`📩 Received message from ${topic} [partition ${partition}]`);

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
        await deliveryConsumerHandler(event);

        console.log(`✅ Message processed successfully`);
      } catch (error: any) {
        console.error(`❌ Error processing message:`, error.message);
        // In production, Kafka would retry based on configuration
      }
    }
  );

  console.log('✅ Delivery Consumer started successfully!');
  console.log('   Waiting for messages...\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down delivery consumer...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down delivery consumer...');
  process.exit(0);
});

// Start the consumer
startDeliveryConsumer().catch((error) => {
  console.error('❌ Failed to start delivery consumer:', error);
  process.exit(1);
});
