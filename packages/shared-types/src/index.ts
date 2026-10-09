export type Uuid = string & { readonly _brand: "Uuid" }

export type ApiResponse<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?:unknown
  }
}

export enum JobStatus{
  PENDING = "PENDING",
  SCHEDULED = "SCHEDULED",
  QUEUED = "QUEUED",
    RUNNING = "RUNNING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    RETRYING = "RETRYING",
    DEAD = "DEAD",
    CANCELLED = "CANCELLED",
}

export enum JobPriority{
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export enum JobType{
  SEND_EMAIL = "SEND_EMAIL",
    GENERATE_REPORT = "GENERATE_REPORT",
    PROCESS_WEBHOOK = "PROCESS_WEBHOOK",
    CLEANUP = "CLEANUP",
}

export interface JobPayload{
  [key:string]:unknown
}

export interface JobResult {
  [key: string]: unknown;
}


export interface Job {
  id: Uuid;
  type: JobType | string;
  status: JobStatus;
  priority: JobPriority;
  payload: JobPayload;
  result?: JobResult | null;
  error?: string | null;
  attempts: number;
  maxAttempts: number;
  leaseOwner?: string | null;
  leaseExpiresAt?: Date | null;
  scheduledAt?: Date | null;
  idempotencyKey?: string | null;
  tenantId?: string | null;
  cancelRequested: boolean;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export enum WorkerStatus {
  ONLINE = "ONLINE",
  OFFLINE = "OFFLINE",
  DRAINING = "DRAINING",
}

export interface WorkerInfo{
  id: string;
    capabilities: string[];
    status: WorkerStatus;
    lastHeartbeatAt: Date;
    registeredAt: Date;
    metadata?: Record<string, unknown>;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}