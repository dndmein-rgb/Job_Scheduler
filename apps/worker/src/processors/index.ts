import { sendEmailProcessor } from "./send-email.processor.js";

type Processor = (payload: unknown) => Promise<Record<string, unknown>>;

const registry: Record<string, Processor> = {
  SEND_EMAIL: sendEmailProcessor,
};

export function getProcessor(type: string): Processor {
  const p = registry[type];
  if (!p) {
    throw new Error(`No processor registered for job type: ${type}`);
  }
  return p;
}