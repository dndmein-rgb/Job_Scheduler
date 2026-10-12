export type DomainPriority = "LOW" | "HIGH" | "MEDIUM" | string

const PRIORITY_MAP: Record<string, number> = {
  HIGH: 1,
  MEDIUM: 5,
  LOW:10
}

export const DEFAULT_BULLMQ_PRIORITY = 5;

export function mapPriorityToBullmq(priority?: DomainPriority | null): number {
  if (!priority) return DEFAULT_BULLMQ_PRIORITY;
  return PRIORITY_MAP[priority] ?? DEFAULT_BULLMQ_PRIORITY;
}