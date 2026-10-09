import type {
  Kafka,
  Consumer,
  EachMessagePayload,
  ConsumerSubscribeTopics,
} from "kafkajs";

export type MessageHandler = (payload: EachMessagePayload) => Promise<void>;

export class KafkaConsumer {
  private consumer: Consumer;
  private connected = false;

  constructor(
    kafka: Kafka,
    private readonly groupId: string,
  ) {
    this.consumer = kafka.consumer({
      groupId: this.groupId,
      sessionTimeout: 30_000,
      heartbeatInterval: 3_000,
    });
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.consumer.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.consumer.disconnect();
    this.connected = false;
  }

  async subscribe(topics: ConsumerSubscribeTopics): Promise<void> {
    if (!this.connected) await this.connect();
    await this.consumer.subscribe(topics);
  }

  async run(handler: MessageHandler): Promise<void> {
    if (!this.connected) await this.connect();
    await this.consumer.run({ eachMessage: handler });
  }
}