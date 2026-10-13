import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";

type QueueResponse = {
  success: boolean;
  data: { queue: string; counts: Record<string, number> };
};

type OutboxResponse = {
  success: boolean;
  data: { pending: number };
};

export function Queues() {
  const queues = useQuery({
    queryKey: ["queues"],
    queryFn: () => apiFetch<QueueResponse>("/admin/queues", { admin: true }),
    refetchInterval: 3000,
  });

  const outbox = useQuery({
    queryKey: ["outbox"],
    queryFn: () =>
      apiFetch<OutboxResponse>("/admin/outbox-stats", { admin: true }),
    refetchInterval: 3000,
  });

  const counts = queues.data?.data.counts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Queues</h1>
        <p className="text-sm text-slate-400">BullMQ + outbox backlog</p>
      </div>

      {queues.isError && (
        <p className="text-red-400">{(queues.error as Error).message}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {counts &&
          Object.entries(counts).map(([k, v]) => (
            <div
              key={k}
              className="rounded-xl border border-slate-700 bg-slate-900 p-4"
            >
              <div className="text-xs uppercase tracking-wide text-slate-400">
                {k}
              </div>
              <div className="mt-1 text-2xl font-semibold">{v}</div>
            </div>
          ))}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="text-sm font-medium text-slate-300">Outbox pending</h2>
        <p className="mt-2 text-3xl font-semibold">
          {outbox.data?.data.pending ?? "—"}
        </p>
        <p className="text-xs text-slate-500">
          Events waiting to publish to Kafka
        </p>
        {outbox.isError && (
          <p className="mt-2 text-sm text-red-400">
            {(outbox.error as Error).message}
          </p>
        )}
      </div>
    </div>
  );
}