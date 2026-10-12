/**
 * Lightweight in-process metrics (Phase 9).
 * No Prometheus dependency — expose via GET /metrics as JSON.
 */

type CounterMap = Record<string, number>

const counters: CounterMap = {
    http_requests_total: 0,
    jobs_created_total: 0,
    jobs_rate_limited_total: 0,
    readiness_checks_total: 0,
    readiness_failures_total: 0,
}

export function inc(name: keyof typeof counters | string, by = 1): void{
  counters[name]=(counters[name]??0)+by
}

export function getMetrics():{service:string,uptimeSec:number,counters:CounterMap} {
  return {
    service: "job-service",
    uptimeSec: Math.floor(process.uptime()),
    counters:{...counters}
  }
}

export function resetMetricsForTests(): void {
  for (const k of Object.keys(counters)) {
    counters[k] = 0;
  }
}