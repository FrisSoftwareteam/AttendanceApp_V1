export default function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-soft">
      <p className="text-xs uppercase tracking-[0.2em] text-ink-500">{label}</p>
      <div className="mt-3 flex items-end justify-between">
        <span className="text-3xl font-semibold text-ink-900">{value}</span>
        <span className="text-sm text-ink-500">{sub}</span>
      </div>
    </div>
  );
}
