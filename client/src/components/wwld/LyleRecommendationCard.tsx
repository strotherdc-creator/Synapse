import { trpc } from "@/lib/trpc";
import { Zap, TrendingDown, TrendingUp, Minus, AlertTriangle, Star } from "lucide-react";

const STATE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; Icon: React.ElementType }
> = {
  breaking:  { label: "URGENT",     color: "text-red-400",    bg: "bg-red-950/30",    border: "border-red-500/40",    Icon: AlertTriangle },
  slipping:  { label: "SLIPPING",   color: "text-orange-400", bg: "bg-orange-950/30", border: "border-orange-500/40", Icon: TrendingDown },
  stuck:     { label: "STUCK",      color: "text-yellow-400", bg: "bg-yellow-950/20", border: "border-yellow-500/40", Icon: Minus },
  plateaued: { label: "PLATEAUED",  color: "text-yellow-300", bg: "bg-yellow-950/20", border: "border-yellow-400/30", Icon: Minus },
  climbing:  { label: "CLIMBING",   color: "text-emerald-400",bg: "bg-emerald-950/30",border: "border-emerald-500/40",Icon: TrendingUp },
  momentum:  { label: "MOMENTUM",   color: "text-[var(--gold)]",bg: "bg-[var(--gold)]/10",border: "border-[var(--gold)]/40",Icon: Star },
};

const METRIC_LABELS: Record<string, string> = {
  office_visits: "Office Visits",
  new_patients:  "New Patients",
  care_plans:    "Care Plans Signed",
};

export function LyleRecommendationCard() {
  const { data, isLoading, isError } = trpc.wwld.getDailyAction.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 min
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border-t-2 border-t-brand-gold/40 border border-brand-gold/15 bg-card p-5 animate-pulse space-y-3">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-3/4 bg-muted rounded" />
      </div>
    );
  }

  if (isError || !data) return null;

  const cfg = STATE_CONFIG[data.trendState] ?? STATE_CONFIG.breaking;
  const { Icon } = cfg;

  return (
    <div className={`rounded-xl border-t-2 border-t-brand-gold/40 border ${cfg.border} ${cfg.bg} p-5 space-y-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className={`w-4 h-4 ${cfg.color}`} />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            What Would Lyle Do?
          </span>
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${cfg.border} ${cfg.bg}`}>
          <Icon className={`w-3 h-3 ${cfg.color}`} />
          <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
        </div>
      </div>

      {/* Pillar + trigger */}
      <div className="space-y-0.5">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{data.pillar}</span>
          {" — "}
          {METRIC_LABELS[data.triggerMetric] ?? data.triggerMetric}
          {data.triggerValue > 0 && (
            <span className={`ml-1 font-bold ${cfg.color}`}>({data.triggerValue} this week)</span>
          )}
        </p>
      </div>

      {/* Weekly theme (if present) */}
      {data.weeklyTheme && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            This Week's Theme
          </p>
          <p className="text-sm text-foreground leading-relaxed">{data.weeklyTheme}</p>
        </div>
      )}

      {/* Divider */}
      {data.weeklyTheme && data.dailyAction && (
        <div className="border-t border-brand-gold/15/50" />
      )}

      {/* Daily action */}
      {data.dailyAction && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Today's Action
          </p>
          <p className={`text-sm font-semibold leading-relaxed ${cfg.color}`}>
            {data.dailyAction}
          </p>
        </div>
      )}

      {/* No data state */}
      {!data.hasEnoughData && (
        <p className="text-xs text-muted-foreground italic">
          Log at least 7 days of stats to unlock trend-based recommendations. Today's action is based on your current data.
        </p>
      )}
    </div>
  );
}
