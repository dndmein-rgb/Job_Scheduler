import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";

type CreateJobResponse = {
  success: boolean;
  data: { id: string };
};

export function CreateJob() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [type, setType] = useState("SEND_EMAIL");
  const [priority, setPriority] = useState("MEDIUM");
  const [tenantId, setTenantId] = useState("");
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [scheduledAt, setScheduledAt] = useState("");
  const [payloadText, setPayloadText] = useState(
    '{\n  "to": "user@example.com",\n  "subject": "Hello"\n}',
  );
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      let payload: unknown;
      try {
        payload = JSON.parse(payloadText);
      } catch {
        throw new Error("Payload must be valid JSON");
      }

      const body: Record<string, unknown> = {
        type,
        priority,
        payload,
        maxAttempts,
      };
      if (tenantId.trim()) body.tenantId = tenantId.trim();
      if (scheduledAt.trim()) {
        body.scheduledAt = new Date(scheduledAt).toISOString();
      }

      return apiFetch<CreateJobResponse>("/jobs", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      navigate(`/jobs/${res.data.id}`);
    },
    onError: (err) => setError((err as Error).message),
  });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create job</h1>
        <p className="text-sm text-slate-400">POST /jobs</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
      >
        <label className="block space-y-1 text-sm">
          <span className="text-slate-400">Type</span>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="SEND_EMAIL">SEND_EMAIL</option>
            <option value="GENERATE_REPORT">GENERATE_REPORT</option>
            <option value="PROCESS_WEBHOOK">PROCESS_WEBHOOK</option>
            <option value="CLEANUP">CLEANUP</option>
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-slate-400">Priority</span>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-slate-400">Tenant ID (optional)</span>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="tenant-1"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-slate-400">Max attempts</span>
          <input
            type="number"
            min={1}
            max={10}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(Number(e.target.value))}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-slate-400">Scheduled at (optional, local time)</span>
          <input
            type="datetime-local"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-slate-400">Payload (JSON)</span>
          <textarea
            rows={8}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs"
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
          />
        </label>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          {mutation.isPending ? "Creating…" : "Create job"}
        </button>
      </form>
    </div>
  );
}