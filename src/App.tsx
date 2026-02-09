import { useMemo } from "react";
import AdminView from "./components/AdminView";
import AuthScreen from "./components/AuthScreen";
import LoadingScreen from "./components/LoadingScreen";
import UserView from "./components/UserView";
import { useAuth } from "./hooks/useAuth";

function App() {
  const dateLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric"
    });
  }, []);

  const { user, loading, login, signup, logout, token } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthScreen onLogin={login} onSignup={signup} />;
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Attendance</p>
          <h1 className="text-2xl font-semibold text-ink-900">FRIS Clock-In</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink-700 shadow-soft">
            {user.name}
          </span>
          <span className="rounded-full bg-ink-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
            {user.role}
          </span>
          <button
            className="rounded-full border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-700"
            onClick={logout}
          >
            Log out
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">
        {user.role === "admin" ? (
          <AdminView dateLabel={dateLabel} token={token} />
        ) : (
          <UserView dateLabel={dateLabel} userName={user.name} token={token} />
        )}
      </main>
    </div>
  );
}

export default App;
