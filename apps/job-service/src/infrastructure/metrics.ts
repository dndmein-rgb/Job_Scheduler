import client from "prom-client"
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: "job_service" })
const httpRequestsTotal = new client.Counter({
  name: "job_service_http_requests_total",
    help: "Total HTTP requests",
    registers: [register],
})

const jobsCreatedTotal = new client.Counter({
  name: "job_service_jobs_created_total",
  help: "Jobs created via API",
  registers: [register],
});

const jobsRateLimitedTotal = new client.Counter({
  name: "job_service_jobs_rate_limited_total",
  help: "Create-job requests rejected by rate limit",
  registers: [register],
});

const readinessChecksTotal = new client.Counter({
  name: "job_service_readiness_checks_total",
  help: "Readiness probe invocations",
  registers: [register],
});

const readinessFailuresTotal = new client.Counter({
  name: "job_service_readiness_failures_total",
  help: "Readiness probe failures",
  registers: [register],
});

const byName: Record<string, client.Counter<string>> = {
  http_requests_total: httpRequestsTotal,
  jobs_created_total: jobsCreatedTotal,
  jobs_rate_limited_total: jobsRateLimitedTotal,
  readiness_checks_total: readinessChecksTotal,
  readiness_failures_total: readinessFailuresTotal,
};

export function inc(name: string, by = 1): void {
  const c = byName[name];
  if (c) c.inc(by);
}

/** Optional: still useful for quick curl debugging */
export function getMetrics(): {
  service: string;
  uptimeSec: number;
  note: string;
} {
  return {
    service: "job-service",
    uptimeSec: Math.floor(process.uptime()),
    note: "Prometheus text at GET /metrics — use metricsText()",
  };
}

export async function metricsText(): Promise<string> {
  return register.metrics();
}

export function resetMetricsForTests(): void {
  register.resetMetrics();
}

export { register };