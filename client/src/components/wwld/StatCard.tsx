interface StatCardProps {
  label: string;
  alias: string;
  value: number | string;
  highlight?: boolean;
}

/** One stat per row: name and short code on the left, the number big on the right. */
export function StatCard({ label, alias, value, highlight }: StatCardProps) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 min-h-16 ${
        highlight ? "bg-[var(--gold)]/10 border-[var(--gold)]" : "bg-card border-brand-gold/15"
      }`}
    >
      <div className="min-w-0">
        <p className="text-base font-semibold text-foreground leading-snug">{label}</p>
        <p className="text-base text-muted-foreground leading-snug">{alias}</p>
      </div>
      <span className={`text-3xl font-bold tabular-nums shrink-0 ${highlight ? "text-[var(--gold)]" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
