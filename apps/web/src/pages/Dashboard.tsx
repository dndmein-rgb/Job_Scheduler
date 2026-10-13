import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";

type StatsResponse = {
  success: boolean;
  data: {
    byStatus: Record<string, number>;
    total: number;
    dead: number;
    running: number;
    queued: number;
    failed: number;
    completed: number;
    cancelled: number;
    scheduled?: number;
    retrying?: number;
  };
};

type ReadyResponse = {
  success: boolean;
  data: {
    status: string;
    checks: { postgres: string; redis: string; kafka: string };
  };
};

type QueueResponse = {
  success: boolean;
  data: { queue: string; counts: Record<string, number> };
};

type OutboxResponse = {
  success: boolean;
  data: { pending: number };
};

function Card({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "danger" | "ok";
}) {
  const toneCls =
    tone === "danger"
      ? "border-red-500/40 bg-red-950/40"
      : tone === "ok"
        ? "border-emerald-500/40 bg-emerald-950/40"
        : "border-slate-700 bg-slate-900";
  return (
    <div className={`rounded-xl border p-4 ${toneCls}`}>
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export function Dashboard() {
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: () => apiFetch<StatsResponse>("/admin/stats", { admin: true }),
    refetchInterval: 5000,
  });

  const ready = useQuery({
    queryKey: ["ready"],
    queryFn: () => apiFetch<ReadyResponse>("/ready"),
    refetchInterval: 5000,
  });

  const queues = useQuery({
    queryKey: ["queues"],
    queryFn: () => apiFetch<QueueResponse>("/admin/queues", { admin: true }),
    refetchInterval: 5000,
  });

  const outbox = useQuery({
    queryKey: ["outbox"],
    queryFn: () =>
      apiFetch<OutboxResponse>("/admin/outbox-stats", { admin: true }),
    refetchInterval: 5000,
  });

  const d = stats.data?.data;
  const checks = ready.data?.data.checks;
  const qc = queues.data?.data.counts;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-400">
          Live view of jobs, queues, and dependencies
        </p>
      </div>

      {stats.isError && (
        <p className="text-red-400">Stats: {(stats.error as Error).message}</p>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Card label="Total" value={d?.total ?? "—"} />
        <Card label="Queued" value={d?.queued ?? "—"} />
        <Card label="Running" value={d?.running ?? "—"} />
        <Card label="Failed" value={d?.failed ?? "—"} />
        <Card label="Dead" value={d?.dead ?? "—"} tone="danger" />
        <Card label="Completed" value={d?.completed ?? "—"} tone="ok" />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-300">Dependencies</h2>
        <div className="flex flex-wrap gap-2">
          {checks &&
            Object.entries(checks).map(([name, status]) => (
              <span
                key={name}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  status === "ok"
                    ? "bg-emerald-900 text-emerald-200"
                    : "bg-red-900 text-red-200"
                }`}
              >
                {name}: {status}
              </span>
            ))}
          {!checks && <span className="text-slate-500">Loading…</span>}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-300">BullMQ</h2>
          {qc ? (
            <ul className="space-y-1 text-sm">
              {Object.entries(qc).map(([k, v]) => (
                <li key={k} className="flex justify-between">
                  <span className="text-slate-400">{k}</span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">
              {queues.isError
                ? (queues.error as Error).message
                : "Loading queue stats…"}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-300">Outbox</h2>
          <p className="text-3xl font-semibold">
            {outbox.data?.data.pending ?? "—"}
          </p>
          <p className="text-xs text-slate-400">pending events (unpublished)</p>
        </div>
      </section>
    </div>
  );
}