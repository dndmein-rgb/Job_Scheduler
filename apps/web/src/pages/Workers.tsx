import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";

type WorkersResponse = {
  success: boolean;
  data: Array<{
    id: string;
    capabilities: string[];
    status: string;
    lastHeartbeatAt: string;
    registeredAt: string;
  }>;
};

export function Workers() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["workers"],
    queryFn: () => apiFetch<WorkersResponse>("/workers"),
    refetchInterval: 5000,
  });

  if (isLoading) return <p className="text-slate-400">Loading workers…</p>;
  if (error) return <p className="text-red-400">{(error as Error).message}</p>;

  const workers = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Workers</h1>
        <p className="text-sm text-slate-400">{workers.length} registered</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {workers.map((w) => (
          <div
            key={w.id}
            className="rounded-xl border border-slate-700 bg-slate-900 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm">{w.id}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  w.status === "ONLINE"
                    ? "bg-emerald-900 text-emerald-200"
                    : "bg-slate-700 text-slate-300"
                }`}
              >
                {w.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Capabilities: {w.capabilities?.join(", ") || "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Heartbeat: {new Date(w.lastHeartbeatAt).toLocaleString()}
            </p>
            <p className="text-xs text-slate-500">
              Registered: {new Date(w.registeredAt).toLocaleString()}
            </p>
          </div>
        ))}
        {workers.length === 0 && (
          <p className="text-slate-500">No workers registered yet.</p>
        )}
      </div>
    </div>
  );
}