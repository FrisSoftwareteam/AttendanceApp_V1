import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Role } from "../types";
import { loginSchema, signupSchema, toFieldErrors } from "../lib/validation";

export default function AuthScreen({
  onLogin,
  onSignup
}: {
  onLogin: (payload: { email: string; password: string }) => Promise<void>;
  onSignup: (payload: {
    name: string;
    email: string;
    password: string;
    role: Role;
    inviteCode?: string;
  }) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<Role>("user");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setError("");
    setFieldErrors({});
  }, [mode]);

  useEffect(() => {
    if (role !== "admin") {
      setInviteCode("");
      setFieldErrors((prev) => {
        if (!prev.inviteCode) {
          return prev;
        }
        const { inviteCode: _ignored, ...rest } = prev;
        return rest;
      });
    }
  }, [role]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors({});

    try {
      if (mode === "login") {
        const parsed = loginSchema.safeParse({ email, password });
        if (!parsed.success) {
          const { fieldErrors: nextErrors, formError } = toFieldErrors(parsed.error);
          setFieldErrors(nextErrors);
          setError(formError ?? "Please fix the errors below.");
          return;
        }
        await onLogin(parsed.data);
      } else {
        const parsed = signupSchema.safeParse({ name, email, password, role, inviteCode });
        if (!parsed.success) {
          const { fieldErrors: nextErrors, formError } = toFieldErrors(parsed.error);
          setFieldErrors(nextErrors);
          setError(formError ?? "Please fix the errors below.");
          return;
        }
        await onSignup(parsed.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-start lg:items-center">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 lg:py-16">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl bg-white p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Welcome</p>
                <h1 className="mt-2 text-3xl font-semibold text-ink-900">Sign in to continue</h1>
                <p className="mt-2 text-ink-600">FRIS Secure photo check-ins with verified locations.</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-ink-50 p-1">
                <button
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    mode === "login" ? "bg-ink-900 text-white" : "text-ink-600"
                  }`}
                  onClick={() => setMode("login")}
                >
                  Login
                </button>
                <button
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    mode === "signup" ? "bg-ink-900 text-white" : "text-ink-600"
                  }`}
                  onClick={() => setMode("signup")}
                >
                  Sign up
                </button>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {mode === "signup" && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
                    Full name
                  </label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-ink-200 px-4 py-3 text-sm outline-none focus:border-ink-400"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Jordan Lee"
                    required
                  />
                  {fieldErrors.name && <p className="mt-2 text-xs text-rose-600">{fieldErrors.name}</p>}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">Email</label>
                <input
                  className="mt-2 w-full rounded-2xl border border-ink-200 px-4 py-3 text-sm outline-none focus:border-ink-400"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  required
                />
                {fieldErrors.email && <p className="mt-2 text-xs text-rose-600">{fieldErrors.email}</p>}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">Password</label>
                <input
                  className="mt-2 w-full rounded-2xl border border-ink-200 px-4 py-3 text-sm outline-none focus:border-ink-400"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                />
                {fieldErrors.password && <p className="mt-2 text-xs text-rose-600">{fieldErrors.password}</p>}
              </div>

              {mode === "signup" && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">Role</label>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <label
                      className={`flex cursor-pointer flex-col rounded-2xl border px-4 py-3 text-sm transition ${
                        role === "user" ? "border-ink-900 bg-ink-50" : "border-ink-200"
                      }`}
                    >
                      <span className="text-sm font-semibold text-ink-900">User</span>
                      <span className="text-xs text-ink-500">Clock in with verified photos.</span>
                      <input
                        className="sr-only"
                        type="radio"
                        name="role"
                        value="user"
                        checked={role === "user"}
                        onChange={() => setRole("user")}
                      />
                    </label>
                    <label
                      className={`flex cursor-pointer flex-col rounded-2xl border px-4 py-3 text-sm transition ${
                        role === "admin" ? "border-ink-900 bg-ink-50" : "border-ink-200"
                      }`}
                    >
                      <span className="text-sm font-semibold text-ink-900">Admin</span>
                      <span className="text-xs text-ink-500">Review attendance and photos.</span>
                      <input
                        className="sr-only"
                        type="radio"
                        name="role"
                        value="admin"
                        checked={role === "admin"}
                        onChange={() => setRole("admin")}
                      />
                    </label>
                  </div>
                  {fieldErrors.role && <p className="mt-2 text-xs text-rose-600">{fieldErrors.role}</p>}
                </div>
              )}

              {mode === "signup" && role === "admin" && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
                    Admin invite code
                  </label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-ink-200 px-4 py-3 text-sm outline-none focus:border-ink-400"
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                    placeholder="Enter invite code"
                    required
                  />
                  {fieldErrors.inviteCode && (
                    <p className="mt-2 text-xs text-rose-600">{fieldErrors.inviteCode}</p>
                  )}
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <button
                className="w-full rounded-2xl bg-ink-900 px-6 py-4 text-base font-semibold text-white transition hover:bg-ink-800 disabled:opacity-60"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
              </button>
            </form>
          </section>

          <aside className="rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-accent-500 p-6 text-white shadow-soft">
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">Why it works</p>
            <h2 className="mt-3 text-2xl font-semibold">Trusted attendance</h2>
            <p className="mt-2 text-sm text-white/80">
              FRIS Clock-ins use your camera and GPS to record a verified snapshot at the time you arrive.
            </p>
            <div className="mt-6 space-y-3 text-sm">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="font-semibold">Verified photo</p>
                <p className="text-white/70">Captured in-app only, with timestamp.</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="font-semibold">Location check</p>
                <p className="text-white/70">Confirms you are on site before saving.</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="font-semibold">Role-based views</p>
                <p className="text-white/70">Admins see dashboards, users see check-ins.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
