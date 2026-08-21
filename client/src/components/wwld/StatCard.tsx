interface StatCardProps {
  label: string;
  alias: string;
  value: number;
  highlight?: boolean;
}

export function StatCard({ label, alias, value, highlight }: StatCardProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border p-4 gap-1 ${
        highlight
          ? "bg-[var(--gold)]/10 border-[var(--gold)]/40"
          : "bg-card border-brand-gold/15"
      }`}
    >
      <span
        className={`text-3xl font-bold tabular-nums ${
          highlight ? "text-[var(--gold)]" : "text-foreground"
        }`}
      >
        {value}
      </span>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {alias}
      </span>
      <span className="text-xs text-muted-foreground text-center leading-tight">
        {label}
      </span>
    </div>
  );
}
