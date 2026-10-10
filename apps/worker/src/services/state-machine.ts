import { JobStatus } from "@job-platform/shared-types";
import { InvalidStateTransitionError } from "@job-platform/shared-utils";

const ALLOWED: Record<JobStatus, readonly JobStatus[]> = {
  PENDING: [JobStatus.QUEUED, JobStatus.SCHEDULED, JobStatus.CANCELLED],
  SCHEDULED: [JobStatus.QUEUED, JobStatus.CANCELLED],
  QUEUED: [JobStatus.RUNNING, JobStatus.CANCELLED],
  RUNNING: [
    JobStatus.COMPLETED,
    JobStatus.FAILED,
    JobStatus.CANCELLED,
    JobStatus.QUEUED, // reaper lease recovery only
  ],
  FAILED: [JobStatus.RETRYING, JobStatus.DEAD],
  RETRYING: [JobStatus.QUEUED],
  COMPLETED: [],
  DEAD: [],
  CANCELLED: [],
};

export function assertTransition(from: JobStatus, to: JobStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}
