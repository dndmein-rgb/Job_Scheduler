import type { WorkerStatus } from "@job-platform/shared-types";
export const WORKER_EVENT_TYPES = {
  REGISTERED: "worker.registered",
  HEARTBEAT: "worker.heartbeat",
  OFFLINE: "worker.offline",
  DRAINING: "worker.draining",
} as const

export type WorkerEventType = (typeof WORKER_EVENT_TYPES)[keyof typeof WORKER_EVENT_TYPES]

export interface WorkerEventBase{
  eventId: string;
  eventType: WorkerEventType;
  occurredAt: string
  workerId:string
}

  export interface WorkerRegisteredEvent extends WorkerEventBase {
    eventType: typeof WORKER_EVENT_TYPES.REGISTERED;
    payload: {
      capabilities: string[];
      metadata?: Record<string, unknown>;
    };
  }
export interface WorkerHeartbeatEvent extends WorkerEventBase {
  eventType: typeof WORKER_EVENT_TYPES.HEARTBEAT;
  payload: {
    status: WorkerStatus;
    activeJobs?: number;
  };
}
export interface WorkerOfflineEvent extends WorkerEventBase {
  eventType: typeof WORKER_EVENT_TYPES.OFFLINE;
  payload: {
    reason?: string;
  };
}

export interface WorkerDrainingEvent extends WorkerEventBase {
  eventType: typeof WORKER_EVENT_TYPES.DRAINING;
  payload: {
    remainingJobs: number;
  };
}

export type WorkerDomainEvent =
  | WorkerRegisteredEvent
  | WorkerHeartbeatEvent
  | WorkerOfflineEvent
  | WorkerDrainingEvent;