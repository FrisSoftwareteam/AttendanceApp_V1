import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../lib/api";
import { formatTime } from "../lib/format";
import { getDeviceLocation, type LocationResult } from "../lib/location";
import type { AttendanceRecord } from "../types";

const statusStyles: Record<string, string> = {
  "Checked in": "bg-emerald-100 text-emerald-800",
  "Not checked in": "bg-rose-100 text-rose-800"
};

export default function UserView({
  dateLabel,
  userName,
  token
}: {
  dateLabel: string;
  userName: string;
  token: string | null;
}) {
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [locationError, setLocationError] = useState("");
  const [locationChecking, setLocationChecking] = useState(false);
  const [locationSource, setLocationSource] = useState<"gps" | "network" | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    setLoading(true);
    apiRequest<{ date: string; items: AttendanceRecord[] }>("/attendance/today", { token })
      .then((data) => {
        setAttendance(data.items[0] ?? null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to load attendance");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    if (!cameraOpen) {
      stopStream();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera not supported in this browser.");
      setCameraOpen(false);
      return;
    }

    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        setError("Unable to access camera. Check permissions.");
        setCameraOpen(false);
      });

    return () => {
      active = false;
      stopStream();
    };
  }, [cameraOpen]);

  const statusLabel = attendance ? "Checked in" : "Not checked in";
  const statusClass = statusStyles[statusLabel];
  const capturedTime = attendance ? formatTime(attendance.capturedAt, attendance.timezone) : "--";

  const checkinEvents = [
    {
      label: "Photo captured",
      value: attendance ? "Saved" : snapshot ? "Ready" : cameraOpen ? "Capturing" : "Pending"
    },
    {
      label: "Location verified",
      value: attendance ? "Recorded" : "Pending"
    },
    {
      label: "Time recorded",
      value: attendance ? capturedTime : "--"
    }
  ];

  const toggleCamera = () => {
    if (attendance) {
      return;
    }
    setError("");
    if (cameraOpen) {
      setCameraOpen(false);
      return;
    }
    setSnapshot(null);
    setCameraOpen(true);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setSnapshot(dataUrl);
    setCameraOpen(false);
  };

  const checkLocation = async () => {
    setLocationChecking(true);
    setLocationError("");
    try {
      const result = await getDeviceLocation();
      setLocation(result);
      setLocationSource("gps");
    } catch (locationErr) {
      setLocation(null);
      setLocationSource(null);
      setLocationError(locationErr instanceof Error ? locationErr.message : "Unable to read location.");
    } finally {
      setLocationChecking(false);
    }
  };

  const useNetworkLocation = async () => {
    if (!token) {
      return;
    }
    setLocationChecking(true);
    setLocationError("");
    try {
      const data = await apiRequest<{ label: string; latitude?: number; longitude?: number }>("/location/ip", {
        token
      });
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        setLocation({
          label: data.label,
          latitude: data.latitude,
          longitude: data.longitude,
          source: "network"
        });
      } else {
        setLocation(null);
      }
      setLocationSource("network");
    } catch (err) {
      setLocation(null);
      setLocationSource(null);
      setLocationError(err instanceof Error ? err.message : "Unable to fetch network location.");
    } finally {
      setLocationChecking(false);
    }
  };

  const handleUploadAndSave = async () => {
    if (!snapshot || !token) {
      return;
    }
    setUploading(true);
    setError("");

    try {
      let resolvedLocation: LocationResult;
      try {
        resolvedLocation = location ?? (await getDeviceLocation());
        if (!locationSource) {
          setLocationSource("gps");
        }
      } catch (locationError) {
        const message =
          locationError instanceof Error ? locationError.message : "Unable to read location.";
        setError(message);
        setLocationError(message);
        setUploading(false);
        return;
      }
      const upload = await apiRequest<{ url: string; publicId: string }>("/uploads/photo", {
        method: "POST",
        token,
        body: { dataUrl: snapshot }
      });

      const record = await apiRequest<AttendanceRecord>("/attendance", {
        method: "POST",
        token,
        body: {
          locationLabel: resolvedLocation.label,
          latitude: resolvedLocation.latitude,
          longitude: resolvedLocation.longitude,
          accuracy: resolvedLocation.accuracy,
          photoUrl: upload.url,
          photoPublicId: upload.publicId
        }
      });

      setAttendance(record);
      setLocation({
        label: record.locationLabel,
        latitude: record.latitude ?? resolvedLocation.latitude,
        longitude: record.longitude ?? resolvedLocation.longitude,
        accuracy: record.accuracy ?? resolvedLocation.accuracy,
        source: locationSource ?? "gps"
      });
      setSnapshot(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRetake = () => {
    setSnapshot(null);
    setCameraOpen(true);
  };

  const handleDelete = async () => {
    if (!attendance || !token) {
      return;
    }
    setUploading(true);
    setError("");
    try {
      await apiRequest<void>(`/attendance/${attendance.id}`, { method: "DELETE", token });
      setAttendance(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete entry");
    } finally {
      setUploading(false);
    }
  };

  const previewImage = snapshot ?? attendance?.photoUrl ?? null;
  const primaryLabel = attendance ? "Checked in" : cameraOpen ? "Close camera" : "Open camera";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-500">{dateLabel}</p>
              <h2 className="mt-2 text-3xl font-semibold text-ink-900">Good morning, {userName}.</h2>
              <p className="mt-2 text-ink-600">
                One photo per day. Delete and retake if needed. Location must be verified.
              </p>
            </div>
            <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-700">
              Mobile first
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-ink-100 bg-ink-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Status</p>
              <div className="mt-3 flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
                  {loading ? "Loading..." : statusLabel}
                </span>
                <span className="text-sm text-ink-600">Today</span>
              </div>
              <p className="mt-3 text-sm text-ink-600">
                {attendance ? `Checked in at ${capturedTime}.` : "No photo recorded yet."}
              </p>
            </div>

            <div className="rounded-2xl border border-ink-100 bg-ink-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Location</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <span className="text-sm font-semibold text-ink-800">
                  {attendance
                    ? "Captured"
                    : location
                      ? "Location ready"
                      : locationChecking
                        ? "Checking..."
                        : "Not checked yet"}
                </span>
              </div>
              <p className="mt-3 text-sm text-ink-600">
                {attendance?.locationLabel ??
                  location?.label ??
                  locationError ??
                  "Enable location access for accuracy."}
              </p>
              {!attendance && (
                <div className="mt-3 grid gap-2">
                  <button
                    className="w-full rounded-2xl border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
                    onClick={checkLocation}
                    disabled={locationChecking || uploading}
                  >
                    {locationChecking
                      ? "Checking..."
                      : locationError
                        ? "Retry location"
                        : location
                          ? "Refresh location"
                          : "Check location"}
                  </button>
                  {locationError && (
                    <button
                      className="w-full rounded-2xl border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
                      onClick={useNetworkLocation}
                      disabled={locationChecking || uploading}
                    >
                      Use network location (approx)
                    </button>
                  )}
                  {locationSource === "network" && (
                    <p className="text-xs text-ink-500">
                      Network location is approximate. Use only if GPS is unavailable.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            className="mt-6 w-full rounded-2xl bg-ink-900 px-6 py-4 text-base font-semibold text-white transition hover:bg-ink-800 disabled:opacity-60"
            onClick={toggleCamera}
            disabled={Boolean(attendance) || uploading}
          >
            {primaryLabel}
          </button>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-500">
            <span className="rounded-full border border-ink-200 px-3 py-1">Camera only</span>
            <span className="rounded-full border border-ink-200 px-3 py-1">No uploads</span>
            <span className="rounded-full border border-ink-200 px-3 py-1">Auto timestamp</span>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-soft">
          <h3 className="text-lg font-semibold text-ink-900">Today&#39;s capture</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
            <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-ink-200 bg-ink-50">
              {cameraOpen ? (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                  <button
                    className="absolute bottom-3 rounded-full bg-white px-4 py-2 text-xs font-semibold text-ink-900 shadow-soft"
                    onClick={capturePhoto}
                  >
                    Capture
                  </button>
                </>
              ) : previewImage ? (
                <img src={previewImage} alt="Attendance preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm text-ink-500">No photo yet</span>
              )}
            </div>
            <div className="space-y-3">
              {checkinEvents.map((event) => (
                <div
                  key={event.label}
                  className="flex items-center justify-between rounded-2xl border border-ink-100 px-4 py-3"
                >
                  <span className="text-sm text-ink-600">{event.label}</span>
                  <span className="text-sm font-semibold text-ink-900">{event.value}</span>
                </div>
              ))}

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              {snapshot && !attendance && (
                <div className="grid gap-2">
                  <button
                    className="w-full rounded-2xl bg-ink-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:opacity-60"
                    onClick={handleUploadAndSave}
                    disabled={uploading}
                  >
                    {uploading ? "Uploading..." : "Upload & Save"}
                  </button>
                  <button
                    className="w-full rounded-2xl border border-ink-200 px-4 py-3 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
                    onClick={handleRetake}
                    disabled={uploading}
                  >
                    Retake photo
                  </button>
                </div>
              )}

              {attendance && (
                <button
                  className="w-full rounded-2xl border border-ink-200 px-4 py-3 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
                  onClick={handleDelete}
                  disabled={uploading}
                >
                  {uploading ? "Deleting..." : "Delete and Retake"}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-accent-500 p-6 text-white shadow-soft">
          <p className="text-xs uppercase tracking-[0.2em] text-white/70">Your day</p>
          <h3 className="mt-3 text-2xl font-semibold">Clock-in confidence</h3>
          <p className="mt-2 text-sm text-white/80">
            The app confirms time, GPS accuracy, and a photo snapshot before logging the day.
          </p>
          <div className="mt-6 grid gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Next</p>
              <p className="mt-1 text-sm">8:30 AM Team Standup</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Reminders</p>
              <p className="mt-1 text-sm">Enable notifications for late alerts</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-soft">
          <h3 className="text-lg font-semibold text-ink-900">Today&#39;s rules</h3>
          <ul className="mt-4 space-y-3 text-sm text-ink-600">
            <li>One check-in per day. Delete to retake.</li>
            <li>Photo capture only from in-app camera.</li>
            <li>GPS must be within the office radius.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
