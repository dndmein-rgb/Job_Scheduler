import type { JobPriority, JobStatus, JobType, Uuid } from "@job-platform/shared-types";

export const JOB_EVENT_TYPES = {
  CREATED: "job.created",
  QUEUED: "job.queued",
  STARTED: "job.started",
  COMPLETED: "job.completed",
  FAILED: "job.failed",
  RETRYING: "job.retrying",
  DEAD: "job.dead",
  CANCELLED: "job.cancelled",
  LEASE_EXPIRED: "job.lease_expired",
  SCHEDULED: "job.scheduled",
} as const;

export type JobEventType = (typeof JOB_EVENT_TYPES)[keyof typeof JOB_EVENT_TYPES];

export interface JobEventBase {
  eventId: Uuid;
  eventType: JobEventType;
  occurredAt: string;
  jobId: Uuid;
  jobType: JobType | string;
  tenantId?: string | null;
}

export interface JobCreatedEvent extends JobEventBase {
  eventType: typeof JOB_EVENT_TYPES.CREATED;
  payload: {
    status: JobStatus;
    priority: JobPriority;
    scheduledAt?: string | null;
    idempotencyKey?: string | null;
    maxAttempts: number;
  };
}

export interface JobQueuedEvent extends JobEventBase {
  eventType: typeof JOB_EVENT_TYPES.QUEUED;
  payload: {
    status: JobStatus;
    priority: JobPriority;
  };
}

export interface JobStartedEvent extends JobEventBase {
  eventType: typeof JOB_EVENT_TYPES.STARTED;
  payload: {
    workerId: string;
    attempt: number;
    leaseExpiresAt: string;
  };
}

export interface JobCompletedEvent extends JobEventBase {
  eventType: typeof JOB_EVENT_TYPES.COMPLETED;
  payload: {
    workerId: string;
    attempt: number;
    result?: Record<string, unknown> | null;
    durationMs: number;
  };
}

export interface JobFailedEvent extends JobEventBase {
  eventType: typeof JOB_EVENT_TYPES.FAILED;
  payload: {
    workerId?: string | null;
    attempt: number;
    error: string;
    willRetry: boolean;
  };
}

export interface JobRetryingEvent extends JobEventBase {
  eventType: typeof JOB_EVENT_TYPES.RETRYING;
  payload: {
    attempt: number;
    nextAttemptAt: string;
    error: string;
  };
}

export interface JobDeadEvent extends JobEventBase {
  eventType: typeof JOB_EVENT_TYPES.DEAD;
  payload: {
    attempts: number;
    lastError: string;
  };
}

export interface JobCancelledEvent extends JobEventBase {
  eventType: typeof JOB_EVENT_TYPES.CANCELLED;
  payload: {
    reason?: string | null;
  };
}

export interface JobLeaseExpiredEvent extends JobEventBase {
  eventType: typeof JOB_EVENT_TYPES.LEASE_EXPIRED;
  payload: {
    previousWorkerId: string;
    leaseExpiredAt: string;
  };
}

export interface JobScheduledEvent extends JobEventBase {
  eventType: typeof JOB_EVENT_TYPES.SCHEDULED;
  payload: {
    scheduledAt: string;
  };
}

export type JobDomainEvent =
  | JobCreatedEvent
  | JobQueuedEvent
  | JobStartedEvent
  | JobCompletedEvent
  | JobFailedEvent
  | JobRetryingEvent
  | JobDeadEvent
  | JobCancelledEvent
  | JobLeaseExpiredEvent
  | JobScheduledEvent;