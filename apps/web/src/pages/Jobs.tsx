import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";

type JobsResponse = {
  success: boolean;
  data: Array<{
    id: string;
    type: string;
    status: string;
    priority: string;
    createdAt: string;
  }>;
  meta?: { total: number };
};

export function Jobs() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => apiFetch<JobsResponse>("/jobs?limit=50"),
    refetchInterval: 5000,
  });

  if (isLoading) return <p className="text-slate-400">Loading jobs…</p>;
  if (error) return <p className="text-red-400">{(error as Error).message}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <Link
          to="/jobs/new"
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium hover:bg-indigo-500"
        >
          Create job
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((j) => (
              <tr key={j.id} className="border-t border-slate-800">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link className="text-indigo-400 hover:underline" to={`/jobs/${j.id}`}>
                    {j.id.slice(0, 8)}…
                  </Link>
                </td>
                <td className="px-3 py-2">{j.type}</td>
                <td className="px-3 py-2">{j.status}</td>
                <td className="px-3 py-2">{j.priority}</td>
                <td className="px-3 py-2 text-slate-400">
                  {new Date(j.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}