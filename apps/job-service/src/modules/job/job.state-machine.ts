/**
 * Explicit lifecycle graph.
 * Why? Prevents illegal updates and documents the system in one place.
 */

import { JobStatus } from "@job-platform/shared-types";
import { InvalidStateTransitionError } from "@job-platform/shared-utils";

const ALLOWED_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  PENDING: [JobStatus.QUEUED, JobStatus.SCHEDULED, JobStatus.CANCELLED],
  SCHEDULED: [JobStatus.QUEUED, JobStatus.CANCELLED],
  QUEUED: [JobStatus.RUNNING, JobStatus.CANCELLED],
  RUNNING: [
    JobStatus.COMPLETED,
    JobStatus.FAILED,
    JobStatus.CANCELLED,
    JobStatus.QUEUED, // reaper lease recovery only
  ],
  FAILED: [JobStatus.RETRYING, JobStatus.DEAD,JobStatus.QUEUED],// admin retry
  RETRYING: [JobStatus.QUEUED,JobStatus.CANCELLED],
  COMPLETED: [],
  DEAD: [JobStatus.QUEUED,JobStatus.CANCELLED],// admin retry
  CANCELLED: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}

export function initialStatusForCreate(
  scheduledAT: Date | null | undefined,
): JobStatus {
  if (scheduledAT && scheduledAT.getTime() > Date.now()) {
    return JobStatus.SCHEDULED;
  }
  return JobStatus.QUEUED;
}
