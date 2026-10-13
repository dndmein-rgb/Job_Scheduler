import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";

type DeadJobsResponse = {
  success: boolean;
  data: Array<{
    id: string;
    type: string;
    status: string;
    error?: string | null;
    attempts: number;
    createdAt: string;
  }>;
  meta?: { total: number; page: number; limit: number };
};

export function DeadLetter() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["dead-jobs"],
    queryFn: () =>
      apiFetch<DeadJobsResponse>("/admin/dead-jobs?limit=50", { admin: true }),
    refetchInterval: 5000,
  });

  const retryMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/dead-jobs/${id}/retry`, { method: "POST", admin: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dead-jobs"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/dead-jobs/${id}/cancel`, {
        method: "POST",
        admin: true,
        body: JSON.stringify({ reason: "cancelled from DLQ UI" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dead-jobs"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  if (list.isLoading) return <p className="text-slate-400">Loading DLQ…</p>;
  if (list.isError)
    return <p className="text-red-400">{(list.error as Error).message}</p>;

  const items = list.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Dead letter</h1>
        <p className="text-sm text-slate-400">
          {list.data?.meta?.total ?? items.length} dead job(s)
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Attempts</th>
              <th className="px-3 py-2">Error</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  No dead jobs
                </td>
              </tr>
            )}
            {items.map((j) => (
              <tr key={j.id} className="border-t border-slate-800">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link
                    to={`/jobs/${j.id}`}
                    className="text-indigo-400 hover:underline"
                  >
                    {j.id.slice(0, 8)}…
                  </Link>
                </td>
                <td className="px-3 py-2">{j.type}</td>
                <td className="px-3 py-2">{j.attempts}</td>
                <td className="max-w-xs truncate px-3 py-2 text-slate-400">
                  {j.error ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      className="text-xs text-indigo-400 hover:underline"
                      onClick={() => retryMut.mutate(j.id)}
                    >
                      Retry
                    </button>
                    <button
                      className="text-xs text-red-400 hover:underline"
                      onClick={() => cancelMut.mutate(j.id)}
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}