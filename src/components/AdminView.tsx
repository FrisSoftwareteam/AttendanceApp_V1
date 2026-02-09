import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { apiRequest } from "../lib/api";
import { downloadFile } from "../lib/download";
import { formatTime } from "../lib/format";
import type { AttendanceRecord, RosterUser } from "../types";
import StatCard from "./StatCard";
import UserHistoryPanel from "./UserHistoryPanel";

const statusStyles: Record<string, string> = {
  "On time": "bg-emerald-100 text-emerald-800",
  Late: "bg-amber-100 text-amber-800",
  Missing: "bg-rose-100 text-rose-800"
};

type AdminRow = {
  id: string;
  name: string;
  time: string;
  status: "On time" | "Late" | "Missing";
  location: string;
  photoUrl?: string;
  photoLabel: string;
  flagComment?: string;
  raw?: AttendanceRecord;
};

export default function AdminView({
  dateLabel,
  token
}: {
  dateLabel: string;
  token: string | null;
}) {
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [items, setItems] = useState<AttendanceRecord[]>([]);
  const [roster, setRoster] = useState<RosterUser[]>([]);
  const [filter, setFilter] = useState<"all" | "on-time" | "late" | "absent">("all");
  const [selected, setSelected] = useState<AdminRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cutoffTime, setCutoffTime] = useState("08:00");
  const [cutoffDraft, setCutoffDraft] = useState("08:00");
  const [savingCutoff, setSavingCutoff] = useState(false);
  const [cutoffError, setCutoffError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportStart, setExportStart] = useState(todayKey);
  const [exportEnd, setExportEnd] = useState(todayKey);
  const [flagDraft, setFlagDraft] = useState("");
  const [flagSaving, setFlagSaving] = useState(false);
  const [flagError, setFlagError] = useState("");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  useEffect(() => {
    if (!token) {
      return;
    }
    setLoading(true);
    const path = `/admin/attendance?date=${selectedDate}`;

    apiRequest<{ date: string; items: AttendanceRecord[]; users: RosterUser[]; cutoffTime?: string }>(path, { token })
      .then((data) => {
        setItems(data.items);
        setRoster(data.users);
        if (data.cutoffTime) {
          setCutoffTime(data.cutoffTime);
          setCutoffDraft(data.cutoffTime);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to load attendance");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, selectedDate]);

  useEffect(() => {
    setExportStart(selectedDate);
    setExportEnd(selectedDate);
  }, [selectedDate]);

  const dateHeading = useMemo(() => {
    if (selectedDate === todayKey) {
      return dateLabel;
    }
    const date = new Date(`${selectedDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return dateLabel;
    }
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric"
    });
  }, [selectedDate, todayKey, dateLabel]);

  const { rows, attendanceRows, absentRows } = useMemo(() => {
    const attendanceRows = items.map((item) => {
      const status = resolveStatus(item, cutoffTime);
      return {
        id: item.id,
        name: item.userName,
        time: formatTime(item.capturedAt, item.timezone),
        status,
        location: item.locationLabel,
        photoUrl: item.photoUrl,
        photoLabel: initials(item.userName),
        flagComment: item.flagComment,
        raw: item
      } satisfies AdminRow;
    });

    const attendanceByUserId = new Map(items.map((item) => [item.userId, item]));
    const absentRows = roster
      .filter((user) => !attendanceByUserId.has(user.id))
      .map((user) => ({
        id: `absent-${user.id}`,
        name: user.name,
        time: "--",
        status: "Missing" as const,
        location: "--",
        photoUrl: undefined,
        photoLabel: initials(user.name)
      }));

    const allRows = [...attendanceRows, ...absentRows].sort((a, b) => a.name.localeCompare(b.name));

    let rows: AdminRow[];
    switch (filter) {
      case "on-time":
        rows = attendanceRows.filter((row) => row.status === "On time");
        break;
      case "late":
        rows = attendanceRows.filter((row) => row.status === "Late");
        break;
      case "absent":
        rows = absentRows;
        break;
      case "all":
      default:
        rows = allRows;
        break;
    }

    return { rows, attendanceRows, absentRows };
  }, [items, roster, filter, cutoffTime]);

  useEffect(() => {
    if (rows.length === 0) {
      setSelected(null);
      return;
    }
    const next = rows.find((row) => row.id === selected?.id) ?? rows[0];
    if (
      !selected ||
      selected.id !== next.id ||
      selected.flagComment !== next.flagComment ||
      selected.photoUrl !== next.photoUrl ||
      selected.time !== next.time
    ) {
      setSelected(next);
    }
  }, [rows, selected]);

  useEffect(() => {
    setFlagDraft(selected?.raw?.flagComment ?? "");
    setFlagError("");
  }, [selected]);

  const stats = useMemo(() => {
    const present = items.length;
    const late = attendanceRows.filter((row) => row.status === "Late").length;
    const missing = Math.max(roster.length - present, 0);
    return { present, late, missing };
  }, [items, attendanceRows, roster]);

  const cutoffValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(cutoffDraft);
  const dateValid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

  const handleExportAll = async () => {
    if (!token) {
      return;
    }
    setExporting(true);
    setExportError("");
    if (!dateValid(exportStart) || !dateValid(exportEnd)) {
      setExportError("Choose a valid start and end date.");
      setExporting(false);
      return;
    }
    if (exportStart > exportEnd) {
      setExportError("Start date must be on or before end date.");
      setExporting(false);
      return;
    }
    try {
      await downloadFile(
        `/admin/export?start=${exportStart}&end=${exportEnd}`,
        token,
        `attendance-${exportStart}-to-${exportEnd}.xlsx`
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Unable to export");
    } finally {
      setExporting(false);
    }
  };

  const handleSaveCutoff = async () => {
    if (!token || !cutoffValid) {
      setCutoffError("Cutoff time must be HH:mm");
      return;
    }
    setSavingCutoff(true);
    setCutoffError("");
    try {
      const data = await apiRequest<{ cutoffTime: string }>("/admin/settings", {
        method: "PUT",
        token,
        body: { cutoffTime: cutoffDraft }
      });
      setCutoffTime(data.cutoffTime);
      setCutoffDraft(data.cutoffTime);
      setHistoryRefreshKey((value) => value + 1);
    } catch (err) {
      setCutoffError(err instanceof Error ? err.message : "Unable to update cutoff time.");
    } finally {
      setSavingCutoff(false);
    }
  };

  const handleFlagSave = async () => {
    if (!token || !selected?.raw) {
      return;
    }
    const comment = flagDraft.trim();
    if (!comment) {
      setFlagError("Comment is required to flag a check-in.");
      return;
    }
    setFlagSaving(true);
    setFlagError("");
    try {
      const updated = await apiRequest<AttendanceRecord>(`/admin/attendance/${selected.raw.id}/flag`, {
        method: "PUT",
        token,
        body: { comment }
      });
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setFlagError(err instanceof Error ? err.message : "Unable to flag check-in.");
    } finally {
      setFlagSaving(false);
    }
  };

  const handleFlagClear = async () => {
    if (!token || !selected?.raw) {
      return;
    }
    setFlagSaving(true);
    setFlagError("");
    try {
      const updated = await apiRequest<AttendanceRecord>(`/admin/attendance/${selected.raw.id}/flag`, {
        method: "PUT",
        token,
        body: { comment: "" }
      });
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setFlagDraft("");
    } catch (err) {
      setFlagError(err instanceof Error ? err.message : "Unable to clear flag.");
    } finally {
      setFlagSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-soft md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink-500">{dateHeading}</p>
          <h2 className="mt-2 text-3xl font-semibold text-ink-900">Attendance overview</h2>
          <p className="mt-2 text-ink-600">
            Review punctuality, verify photo evidence, and spot missing check-ins.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink-200 px-3 py-2 text-xs text-ink-600">
            <span className="text-[10px] uppercase tracking-[0.2em] text-ink-500">Export period</span>
            <input
              type="date"
              className="rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-700"
              value={exportStart}
              onChange={(event) => setExportStart(event.target.value)}
            />
            <span className="text-[10px] uppercase tracking-[0.2em] text-ink-500">to</span>
            <input
              type="date"
              className="rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-700"
              value={exportEnd}
              onChange={(event) => setExportEnd(event.target.value)}
            />
            <button
              className="rounded-full border border-ink-900 px-3 py-1 text-xs font-semibold text-ink-900 disabled:opacity-60"
              onClick={handleExportAll}
              disabled={exporting || !token}
            >
              {exporting ? "Exporting..." : "Export all staff"}
            </button>
          </div>
          <button className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white">
            Send reminder
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Present" value={String(stats.present)} sub="checked in" />
          <StatCard label="Late" value={String(stats.late)} sub={`after ${cutoffTime}`} />
          <StatCard label="Missing" value={String(stats.missing)} sub="no photo" />
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-soft">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Cutoff time</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="time"
              className="rounded-full border border-ink-200 px-4 py-2 text-sm text-ink-700"
              value={cutoffDraft}
              onChange={(event) => setCutoffDraft(event.target.value)}
            />
            <button
              className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={handleSaveCutoff}
              disabled={!cutoffValid || savingCutoff || cutoffDraft === cutoffTime}
            >
              {savingCutoff ? "Saving..." : "Update"}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-500">Applies to new check-ins and reports.</p>
          {cutoffError && <p className="mt-2 text-xs text-rose-600">{cutoffError}</p>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        <div className="rounded-3xl bg-white p-6 shadow-soft min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-ink-900">Today&#39;s check-ins</h3>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  className="rounded-full border border-ink-200 px-4 py-2 text-sm text-ink-700"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
                {selectedDate !== todayKey && (
                  <button
                    className="rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700"
                    onClick={() => setSelectedDate(todayKey)}
                  >
                    Today
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
                All teams
              </FilterButton>
              <FilterButton active={filter === "on-time"} onClick={() => setFilter("on-time")}>
                On time
              </FilterButton>
              <FilterButton active={filter === "late"} onClick={() => setFilter("late")}>
                Late
              </FilterButton>
              <FilterButton active={filter === "absent"} onClick={() => setFilter("absent")}>
                Absent
              </FilterButton>
            </div>
          </div>

          <div className="mt-4 w-full min-w-0 max-w-full overflow-x-auto rounded-2xl border border-ink-100">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead className="bg-ink-50 text-xs uppercase tracking-[0.2em] text-ink-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Photo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-t border-ink-100 transition hover:bg-ink-50 ${
                      selected?.id === row.id ? "bg-ink-50" : ""
                    }`}
                    onClick={() => setSelected(row)}
                  >
                    <td className="px-4 py-3 font-semibold text-ink-900">{row.name}</td>
                    <td className="px-4 py-3 text-ink-700">{row.time}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[row.status]}`}
                        >
                          {row.status}
                        </span>
                        {row.flagComment && (
                          <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                            Flagged
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{row.location}</td>
                    <td className="px-4 py-3">
                      {row.photoUrl ? (
                        <img
                          src={row.photoUrl}
                          alt={row.name}
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
                          {row.photoLabel}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-ink-500" colSpan={5}>
                      No check-ins recorded yet.
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

        <div className="rounded-3xl bg-white p-6 shadow-soft min-w-0">
          <h3 className="text-lg font-semibold text-ink-900">Verified capture</h3>
          <div className="mt-4 flex w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-ink-200 bg-ink-50 aspect-[3/4] max-h-[60vh] sm:aspect-[4/5] lg:aspect-[3/4] min-w-0">
            {selected?.photoUrl ? (
              <img src={selected.photoUrl} alt={selected.name} className="h-full w-full object-contain" />
            ) : (
              <span className="text-sm text-ink-500">Select a row to preview</span>
            )}
          </div>
          <div className="mt-4 space-y-3 text-sm text-ink-600">
            <div className="flex items-center justify-between">
              <span>Employee</span>
              <span className="font-semibold text-ink-900">{selected?.name ?? "--"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Captured</span>
              <span className="font-semibold text-ink-900">{selected?.time ?? "--"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Location</span>
              <span className="font-semibold text-ink-900">{selected?.location ?? "--"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Flag status</span>
              <span className="font-semibold text-ink-900">
                {selected?.flagComment ? "Flagged" : "Clear"}
              </span>
            </div>
          </div>

          {selected?.raw ? (
            <div className="mt-6 space-y-3">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
                Flag comment
              </label>
              <textarea
                className="min-h-[88px] w-full resize-none rounded-2xl border border-ink-200 px-4 py-3 text-sm text-ink-700 focus:border-ink-400"
                placeholder="Describe the issue for this check-in"
                value={flagDraft}
                onChange={(event) => setFlagDraft(event.target.value)}
              />
              {flagError && <p className="text-xs text-rose-600">{flagError}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-2xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={handleFlagSave}
                  disabled={flagSaving}
                >
                  {flagSaving ? "Saving..." : "Save flag"}
                </button>
                <button
                  className="rounded-2xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 disabled:opacity-60"
                  onClick={handleFlagClear}
                  disabled={flagSaving || !selected?.flagComment}
                >
                  Clear flag
                </button>
              </div>
            </div>
          ) : (
            <button className="mt-6 w-full rounded-2xl border border-ink-200 px-4 py-3 text-sm font-semibold text-ink-700 transition hover:bg-ink-50" disabled>
              Flag issue
            </button>
          )}
        </div>
      </div>

      <UserHistoryPanel
        token={token}
        roster={roster}
        cutoffTime={cutoffTime}
        refreshKey={historyRefreshKey}
      />
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
        active ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 text-ink-600"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function resolveStatus(item: AttendanceRecord, cutoffTime: string): "On time" | "Late" {
  const cutoff = parseCutoffTime(cutoffTime) ?? { hour: 8, minute: 0 };
  const { hour, minute } = getLocalTimeParts(item.capturedAt, item.timezone);
  if (hour < cutoff.hour) {
    return "On time";
  }
  if (hour === cutoff.hour && minute <= cutoff.minute) {
    return "On time";
  }
  return "Late";
}

function getLocalTimeParts(iso: string, timeZone?: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { hour: 0, minute: 0 };
  }
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone
    });
    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    return { hour, minute };
  } catch {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    return { hour, minute };
  }
}

function parseCutoffTime(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return null;
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
