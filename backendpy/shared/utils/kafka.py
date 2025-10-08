"""
Kafka utility functions for topic management and event publishing
"""
import os
import json
from kafka import KafkaAdminClient, KafkaProducer
from kafka.admin import NewTopic
from kafka.errors import TopicAlreadyExistsError, KafkaError


def get_kafka_admin_client():
    """
    Get Kafka Admin Client

    Returns:
        KafkaAdminClient instance or None if Kafka is disabled
    """
    kafka_enabled = os.environ.get('KAFKA_ENABLED', 'false').lower() == 'true'

    if not kafka_enabled:
        print("Kafka is disabled. Set KAFKA_ENABLED=true to enable.")
        return None

    kafka_brokers = os.environ.get('KAFKA_BROKERS', 'localhost:9092')

    try:
        admin_client = KafkaAdminClient(
            bootstrap_servers=kafka_brokers.split(','),
            client_id='webhook-system-admin'
        )
        return admin_client
    except Exception as e:
        print(f"Failed to connect to Kafka: {e}")
        return None


def create_topic_for_schema(event_type, num_partitions=3, replication_factor=1):
    """
    Create a Kafka topic for a schema's event type

    Args:
        event_type: The event type (e.g., "user.created")
        num_partitions: Number of partitions for the topic (default: 3)
        replication_factor: Replication factor (default: 1)

    Returns:
        Dict with success status and topic name
    """
    admin_client = get_kafka_admin_client()

    if not admin_client:
        return {
            'success': False,
            'topic': None,
            'message': 'Kafka is disabled or unavailable'
        }

    # Convert event type to topic name (e.g., "user.created" -> "user-created")
    topic_name = event_type.replace('.', '-')

    try:
        # Create topic
        topic = NewTopic(
            name=topic_name,
            num_partitions=num_partitions,
            replication_factor=replication_factor
        )

        admin_client.create_topics(new_topics=[topic], validate_only=False)

        print(f"Created Kafka topic: {topic_name}")

        return {
            'success': True,
            'topic': topic_name,
            'message': f'Topic {topic_name} created successfully'
        }

    except TopicAlreadyExistsError:
        print(f"Kafka topic already exists: {topic_name}")
        return {
            'success': True,
            'topic': topic_name,
            'message': f'Topic {topic_name} already exists'
        }

    except KafkaError as e:
        print(f"Failed to create Kafka topic {topic_name}: {e}")
        return {
            'success': False,
            'topic': None,
            'message': f'Failed to create topic: {str(e)}'
        }

    finally:
        try:
            admin_client.close()
        except:
            pass


def delete_topic_for_schema(event_type):
    """
    Delete a Kafka topic for a schema's event type

    Args:
        event_type: The event type (e.g., "user.created")

    Returns:
        Dict with success status
    """
    admin_client = get_kafka_admin_client()

    if not admin_client:
        return {
            'success': False,
            'message': 'Kafka is disabled or unavailable'
        }

    # Convert event type to topic name
    topic_name = event_type.replace('.', '-')

    try:
        admin_client.delete_topics(topics=[topic_name])

        print(f"Deleted Kafka topic: {topic_name}")

        return {
            'success': True,
            'message': f'Topic {topic_name} deleted successfully'
        }

    except KafkaError as e:
        print(f"Failed to delete Kafka topic {topic_name}: {e}")
        return {
            'success': False,
            'message': f'Failed to delete topic: {str(e)}'
        }

    finally:
        try:
            admin_client.close()
        except:
            pass


def list_topics():
    """
    List all Kafka topics

    Returns:
        List of topic names or empty list if Kafka is unavailable
    """
    admin_client = get_kafka_admin_client()

    if not admin_client:
        return []

    try:
        topics = admin_client.list_topics()
        return topics

    except KafkaError as e:
        print(f"Failed to list Kafka topics: {e}")
        return []

    finally:
        try:
            admin_client.close()
        except:
            pass


def publish_event_to_kafka(event_type, event_data):
    """
    Publish an event to Kafka topic

    Args:
        event_type: The event type (e.g., "user.created")
        event_data: Dict containing event data to publish

    Returns:
        Dict with success status and message
    """
    kafka_enabled = os.environ.get('KAFKA_ENABLED', 'false').lower() == 'true'

    if not kafka_enabled:
        print("Kafka is disabled. Event not published to Kafka.")
        return {
            'success': False,
            'message': 'Kafka is disabled'
        }

    kafka_brokers = os.environ.get('KAFKA_BROKERS', 'localhost:9092')

    # Convert event type to topic name (e.g., "user.created" -> "user-created")
    topic_name = event_type.replace('.', '-')

    try:
        # Create Kafka producer
        producer = KafkaProducer(
            bootstrap_servers=kafka_brokers.split(','),
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            client_id='webhook-system-producer'
        )

        # Send message to Kafka topic
        future = producer.send(topic_name, value=event_data)

        # Wait for the message to be sent (with timeout)
        record_metadata = future.get(timeout=10)

        producer.flush()
        producer.close()

        print(f"Published event to Kafka topic '{topic_name}': partition={record_metadata.partition}, offset={record_metadata.offset}")

        return {
            'success': True,
            'topic': topic_name,
            'partition': record_metadata.partition,
            'offset': record_metadata.offset,
            'message': f'Event published to Kafka topic {topic_name}'
        }

    except Exception as e:
        print(f"Failed to publish event to Kafka topic {topic_name}: {e}")
        return {
            'success': False,
            'topic': topic_name,
            'message': f'Failed to publish to Kafka: {str(e)}'
        }
