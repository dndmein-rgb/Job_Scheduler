import { Kafka, KafkaConfig, logLevel } from "kafkajs";

export interface CreateKafkaClientOptions {
  clientId: string;
  brokers: string[];
  logLevel?: logLevel;
}

export function createKafkaClient(options: CreateKafkaClientOptions): Kafka {
  const config: KafkaConfig = {
    brokers: options.brokers,
    clientId: options.clientId,
    logLevel: options.logLevel ?? logLevel.WARN,
    retry: {
      initialRetryTime: 300,
      retries: 8,
    },
  };
  return new Kafka(config);
}
