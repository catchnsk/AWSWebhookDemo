import { Kafka, Producer, Consumer, EachMessagePayload, KafkaMessage } from 'kafkajs';

let kafka: Kafka | null = null;
let producer: Producer | null = null;
let consumer: Consumer | null = null;

/**
 * Initialize Kafka client
 */
export function initializeKafka(): Kafka {
  if (!kafka) {
    const brokers = (process.env.KAFKA_BROKERS || '').split(',').filter(Boolean);

    if (brokers.length === 0) {
      throw new Error('KAFKA_BROKERS environment variable is not set');
    }

    kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'webhook-system',
      brokers,
      retry: {
        initialRetryTime: 300,
        retries: 8,
      },
      connectionTimeout: 10000,
      requestTimeout: 30000,
    });

    console.log('Kafka client initialized with brokers:', brokers);
  }

  return kafka;
}

/**
 * Get or create Kafka producer
 */
export async function getProducer(): Promise<Producer> {
  if (!producer) {
    const kafkaClient = initializeKafka();
    producer = kafkaClient.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
      idempotent: true, // Ensures exactly-once semantics
      maxInFlightRequests: 5,
      retry: {
        initialRetryTime: 300,
        retries: 8,
      },
    });

    await producer.connect();
    console.log('Kafka producer connected');
  }

  return producer;
}

/**
 * Get or create Kafka consumer
 */
export async function getConsumer(groupId: string): Promise<Consumer> {
  if (!consumer) {
    const kafkaClient = initializeKafka();
    consumer = kafkaClient.consumer({
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxWaitTimeInMs: 5000,
      retry: {
        initialRetryTime: 300,
        retries: 8,
      },
    });

    await consumer.connect();
    console.log(`Kafka consumer connected with group ID: ${groupId}`);
  }

  return consumer;
}

/**
 * Publish message to Kafka topic
 */
export async function publishMessage(
  topic: string,
  message: any,
  key?: string
): Promise<void> {
  const producerInstance = await getProducer();

  try {
    await producerInstance.send({
      topic,
      messages: [
        {
          key: key || null,
          value: JSON.stringify(message),
          timestamp: Date.now().toString(),
        },
      ],
    });

    console.log('Message published to Kafka:', { topic, key });
  } catch (error) {
    console.error('Failed to publish message to Kafka:', { topic, error });
    throw error;
  }
}

/**
 * Publish batch of messages to Kafka topic
 */
export async function publishBatch(
  topic: string,
  messages: Array<{ key?: string; value: any }>
): Promise<void> {
  const producerInstance = await getProducer();

  try {
    await producerInstance.send({
      topic,
      messages: messages.map((msg) => ({
        key: msg.key || null,
        value: JSON.stringify(msg.value),
        timestamp: Date.now().toString(),
      })),
    });

    console.log('Batch messages published to Kafka:', { topic, count: messages.length });
  } catch (error) {
    console.error('Failed to publish batch messages to Kafka:', { topic, error });
    throw error;
  }
}

/**
 * Subscribe to Kafka topic and process messages
 */
export async function subscribe(
  topic: string,
  groupId: string,
  handler: (payload: EachMessagePayload) => Promise<void>
): Promise<void> {
  const consumerInstance = await getConsumer(groupId);

  await consumerInstance.subscribe({ topic, fromBeginning: false });

  await consumerInstance.run({
    eachMessage: async (payload: EachMessagePayload) => {
      try {
        await handler(payload);
        // Message will be auto-committed if processing succeeds
      } catch (error) {
        console.error('Error processing Kafka message:', {
          topic: payload.topic,
          partition: payload.partition,
          offset: payload.message.offset,
          error,
        });
        // Let Kafka retry based on consumer config
        throw error;
      }
    },
  });

  console.log(`Subscribed to Kafka topic: ${topic}`);
}

/**
 * Parse Kafka message value
 */
export function parseMessage<T = any>(message: KafkaMessage): T {
  if (!message.value) {
    throw new Error('Message value is null or undefined');
  }

  try {
    return JSON.parse(message.value.toString());
  } catch (error) {
    console.error('Failed to parse Kafka message:', error);
    throw error;
  }
}

/**
 * Disconnect Kafka producer
 */
export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    console.log('Kafka producer disconnected');
  }
}

/**
 * Disconnect Kafka consumer
 */
export async function disconnectConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
    console.log('Kafka consumer disconnected');
  }
}

/**
 * Disconnect all Kafka connections
 */
export async function disconnectKafka(): Promise<void> {
  await Promise.all([disconnectProducer(), disconnectConsumer()]);
  kafka = null;
}

/**
 * Webhook event message structure
 */
export interface WebhookEventMessage {
  webhookId: string;
  executionId: string;
  eventType: string;
  payload: any;
  metadata: {
    webhookUrl: string;
    authType: string;
    authToken?: string;
    authUsername?: string;
    customHeaders?: Record<string, string>;
    retryAttempt: number;
    maxRetries: number;
    backoffStrategy: 'exponential' | 'linear' | 'constant';
    initialDelayMs: number;
    timeoutMs: number;
    webhookSecret: string;
  };
  timestamp: string;
}

/**
 * Create webhook event message
 */
export function createWebhookEventMessage(
  webhook: any,
  executionId: string,
  payload: any
): WebhookEventMessage {
  return {
    webhookId: webhook.id,
    executionId,
    eventType: webhook.event_type,
    payload,
    metadata: {
      webhookUrl: webhook.url,
      authType: webhook.auth_type || 'none',
      authToken: webhook.auth_config?.token,
      authUsername: webhook.auth_config?.username,
      customHeaders: webhook.custom_headers,
      retryAttempt: 0,
      maxRetries: webhook.max_retries || 3,
      backoffStrategy: webhook.backoff_strategy || 'exponential',
      initialDelayMs: webhook.initial_delay_ms || 1000,
      timeoutMs: webhook.timeout_ms || 30000,
      webhookSecret: webhook.secret,
    },
    timestamp: new Date().toISOString(),
  };
}