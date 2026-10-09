import { createKafkaClient, KafkaProducer } from "@job-platform/shared-kafka";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";

const kafka = createKafkaClient({
  brokers: [config.KAFKA_BROKER],
  clientId:config.KAFKA_CLIENT_ID
})

export const kafkaProducer = new KafkaProducer(kafka);


export async function connectKafka(): Promise<void> {
  await kafkaProducer.connect();
  logger.info( "Kafka producer connected",{ brokers: config.KAFKA_BROKER });
}

export async function disconnectKafka(): Promise<void> {
  await kafkaProducer.disconnect();
  logger.info("Kafka producer disconnected");
}