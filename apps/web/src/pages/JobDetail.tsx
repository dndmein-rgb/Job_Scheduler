import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";

type JobResponse = {
  success: boolean;
  data: {
    id: string;
    type: string;
    status: string;
    priority: string;
    payload: unknown;
    result?: unknown;
    error?: string | null;
    attempts: number;
    maxAttempts: number;
    leaseOwner?: string | null;
    leaseExpiresAt?: string | null;
    scheduledAt?: string | null;
    tenantId?: string | null;
    cancelRequested: boolean;
    createdAt: string;
    updatedAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
  };
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-slate-800 py-2 text-sm">
      <div className="text-slate-400">{label}</div>
      <div className="col-span-2 break-all">{value}</div>
    </div>
  );
}

export function JobDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();

  const job = useQuery({
    queryKey: ["job", id],
    queryFn: () => apiFetch<JobResponse>(`/jobs/${id}`),
    enabled: !!id,
    refetchInterval: 3000,
  });

  const cancelMut = useMutation({
    mutationFn: () =>
      apiFetch(`/jobs/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "cancelled from UI" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const retryMut = useMutation({
    mutationFn: () => apiFetch(`/jobs/${id}/retry`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  if (job.isLoading) return <p className="text-slate-400">Loading…</p>;
  if (job.isError)
    return <p className="text-red-400">{(job.error as Error).message}</p>;

  const j = job.data!.data;
  const canCancel = !["COMPLETED", "CANCELLED", "DEAD"].includes(j.status);
  const canRetry = ["FAILED", "DEAD"].includes(j.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/jobs" className="text-sm text-indigo-400 hover:underline">
            ← Jobs
          </Link>
          <h1 className="mt-1 font-mono text-xl font-semibold">{j.id}</h1>
        </div>
        <div className="flex gap-2">
          {canCancel && (
            <button
              onClick={() => cancelMut.mutate()}
              disabled={cancelMut.isPending}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          {canRetry && (
            <button
              onClick={() => retryMut.mutate()}
              disabled={retryMut.isPending}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {(cancelMut.isError || retryMut.isError) && (
        <p className="text-sm text-red-400">
          {(cancelMut.error as Error)?.message ||
            (retryMut.error as Error)?.message}
        </p>
      )}

      <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
        <Row label="Type" value={j.type} />
        <Row label="Status" value={j.status} />
        <Row label="Priority" value={j.priority} />
        <Row label="Attempts" value={`${j.attempts} / ${j.maxAttempts}`} />
        <Row label="Tenant" value={j.tenantId ?? "—"} />
        <Row label="Lease owner" value={j.leaseOwner ?? "—"} />
        <Row
          label="Lease expires"
          value={
            j.leaseExpiresAt ? new Date(j.leaseExpiresAt).toLocaleString() : "—"
          }
        />
        <Row
          label="Scheduled"
          value={
            j.scheduledAt ? new Date(j.scheduledAt).toLocaleString() : "—"
          }
        />
        <Row label="Created" value={new Date(j.createdAt).toLocaleString()} />
        <Row
          label="Started"
          value={j.startedAt ? new Date(j.startedAt).toLocaleString() : "—"}
        />
        <Row
          label="Completed"
          value={
            j.completedAt ? new Date(j.completedAt).toLocaleString() : "—"
          }
        />
        <Row label="Error" value={j.error ?? "—"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-300">Payload</h2>
          <pre className="overflow-auto text-xs text-slate-300">
            {JSON.stringify(j.payload, null, 2)}
          </pre>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-300">Result</h2>
          <pre className="overflow-auto text-xs text-slate-300">
            {j.result ? JSON.stringify(j.result, null, 2) : "—"}
          </pre>
        </div>
      </div>
    </div>
  );
}