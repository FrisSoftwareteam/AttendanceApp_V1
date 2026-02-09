import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api";
import { downloadFile } from "../lib/download";
import { formatDate, formatTime } from "../lib/format";
import type { AttendanceRecord, RosterUser } from "../types";

const statusStyles: Record<string, string> = {
  "On time": "bg-emerald-100 text-emerald-800",
  Late: "bg-amber-100 text-amber-800"
};

type HistoryStats = {
  onTime: number;
  late: number;
  total: number;
  punctualityRate: number;
};

type HistoryResponse = {
  user: RosterUser;
  month: string;
  cutoffTime: string;
  stats: HistoryStats;
  items: AttendanceRecord[];
};

export default function UserHistoryPanel({
  token,
  roster,
  cutoffTime,
  refreshKey
}: {
  token: string | null;
  roster: RosterUser[];
  cutoffTime: string;
  refreshKey: number;
}) {
  const defaultMonth = useMemo(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${month}`;
  }, []);

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [month, setMonth] = useState(defaultMonth);
  const [items, setItems] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<HistoryStats>({ onTime: 0, late: 0, total: 0, punctualityRate: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    if (!selectedUserId && roster.length > 0) {
      setSelectedUserId(roster[0].id);
    }
  }, [roster, selectedUserId]);

  useEffect(() => {
    if (!token || !selectedUserId) {
      return;
    }
    setLoading(true);
    const path = `/admin/users/${selectedUserId}/attendance?month=${month}`;

    apiRequest<HistoryResponse>(path, { token })
      .then((data) => {
        setItems(data.items ?? []);
        setStats(data.stats ?? { onTime: 0, late: 0, total: 0, punctualityRate: 0 });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to load history");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, selectedUserId, month, refreshKey]);

  const selectedUser = roster.find((user) => user.id === selectedUserId);
  const punctualityLabel = `${stats.punctualityRate}% on-time`;

  const handleExportUser = async () => {
    if (!token || !selectedUserId) {
      return;
    }
    setExporting(true);
    setExportError("");
    try {
      await downloadFile(`/admin/users/${selectedUserId}/export?month=${month}`, token, `attendance-${month}.xlsx`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Unable to export");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="rounded-3xl bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink-900">Per-user history</h3>
          <p className="mt-1 text-sm text-ink-600">
            Punctuality rate is based on days with check-ins. Cutoff time: {cutoffTime}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-full border border-ink-200 px-4 py-2 text-sm text-ink-700"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
          >
            {roster.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <input
            type="month"
            className="rounded-full border border-ink-200 px-4 py-2 text-sm text-ink-700"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
          <button
            className="rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 disabled:opacity-60"
            onClick={handleExportUser}
            disabled={exporting || !token || !selectedUserId}
          >
            {exporting ? "Exporting..." : "Export user"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-ink-100 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Punctuality</p>
          <p className="mt-3 text-2xl font-semibold text-ink-900">{punctualityLabel}</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${stats.punctualityRate}%` }}
            ></div>
          </div>
        </div>
        <div className="rounded-2xl border border-ink-100 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-500">On time</p>
          <p className="mt-3 text-2xl font-semibold text-ink-900">{stats.onTime}</p>
          <p className="mt-2 text-sm text-ink-500">Days checked in on time</p>
        </div>
        <div className="rounded-2xl border border-ink-100 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Late</p>
          <p className="mt-3 text-2xl font-semibold text-ink-900">{stats.late}</p>
          <p className="mt-2 text-sm text-ink-500">Days checked in late</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-100">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase tracking-[0.2em] text-ink-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Location</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const status = statusLabel(item.status);
              return (
                <tr key={item.id} className="border-t border-ink-100">
                  <td className="px-4 py-3 text-ink-700">
                    {formatDate(item.capturedAt, item.timezone)}
                  </td>
                  <td className="px-4 py-3 text-ink-700">
                    {formatTime(item.capturedAt, item.timezone)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}>
                        {status}
                      </span>
                      {item.flagComment && (
                        <span
                          className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700"
                          title={item.flagComment}
                        >
                          Flagged
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{item.locationLabel}</td>
                </tr>
              );
            })}
            {!loading && items.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-sm text-ink-500" colSpan={4}>
                  No check-ins found for {selectedUser?.name ?? "this user"}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {exportError && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {exportError}
        </div>
      )}
    </div>
  );
}

function statusLabel(status: AttendanceRecord["status"]) {
  return status === "late" ? "Late" : "On time";
}
