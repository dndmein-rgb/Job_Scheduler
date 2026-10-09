export const TOPICS = {
  JOB_EVENTS: "job.events",
  WORKER_EVENTS: "worker.events",
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];