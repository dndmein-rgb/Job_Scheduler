import type { Kafka, Producer, ProducerRecord, RecordMetadata } from "kafkajs";

export class KafkaProducer {
  private producer: Producer;
  private connected = false;

  constructor(kafka: Kafka) {
    this.producer = kafka.producer({
      allowAutoTopicCreation: true,
      idempotent: true,
    });
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.producer.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.producer.disconnect();
    this.connected = false;
  }

  async send(record: ProducerRecord): Promise<RecordMetadata[]> {
    if (!this.connected) await this.connect();
    return this.producer.send(record);
  }

  async sendBatch(records: ProducerRecord[]): Promise<RecordMetadata[]> {
    if (!this.connected) await this.connect();
    const result = await this.producer.sendBatch({ topicMessages: records });
    return result.flat();
  }
}