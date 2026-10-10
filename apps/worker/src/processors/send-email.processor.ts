import { sleep } from "@job-platform/shared-utils";
import { logger } from "../config/logger.js";

export async function sendEmailProcessor(payload: unknown): Promise<Record<string, unknown>>{
  const data = payload as { to?: string; subject?: string };
  
    logger.info("SEND_EMAIL starting", { to: data.to, subject: data.subject });
    await sleep(500);
  
    if (data.to === "fail@example.com") {
      throw new Error("Simulated email failure");
    }
  
    return {
      sent: true,
      to: data.to ?? null,
      at: new Date().toISOString(),
    };
}