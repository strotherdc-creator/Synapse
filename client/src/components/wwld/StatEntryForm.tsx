import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, Minus, Plus, CheckCircle2, Settings2 } from "lucide-react";
import {
  BUILTIN_STATS,
  BUILTIN_STAT_KEYS,
  CUSTOM_STAT_VALUE_MAX,
  type BuiltinStatKey,
} from "@shared/wwldStats";

type SessionType = "morning" | "afternoon" | "end_of_day";

type StatValues = Record<BuiltinStatKey, number>;

const SESSION_LABELS: Record<SessionType, string> = {
  morning: "Morning Stats",
  afternoon: "Afternoon Stats",
  end_of_day: "End of Day Stats",
};

const BUILTIN_MAX = 9999;

interface StatEntryFormProps {
  sessionType: SessionType;
  sessionDate: string; // YYYY-MM-DD
  initialValues?: Partial<StatValues>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function StatEntryForm({
  sessionType,
  sessionDate,
  initialValues,
  onSuccess,
  onCancel,
}: StatEntryFormProps) {
  const [values, setValues] = useState<StatValues>({
    officeVisits: initialValues?.officeVisits ?? 0,
    newPatients: initialValues?.newPatients ?? 0,
    recall: initialValues?.recall ?? 0,
    testResults: initialValues?.testResults ?? 0,
    progressExams: initialValues?.progressExams ?? 0,
    performanceReviews: initialValues?.performanceReviews ?? 0,
    carePlansSigned: initialValues?.carePlansSigned ?? 0,
  });
  // Custom stat values keyed by custom stat id
  const [customValues, setCustomValues] = useState<Record<number, number>>({});
  const [customTouched, setCustomTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // The doctor's Log Stats settings — which built-in stats to show + their custom stats.
  const settingsQuery = trpc.wwld.getStatSettings.useQuery(undefined, { staleTime: 60_000 });
  const savedCustomQuery = trpc.wwld.getCustomStatValues.useQuery({ date: sessionDate });

  // Pre-fill any custom values already saved for this session (editing).
  useEffect(() => {
    if (!savedCustomQuery.data || customTouched) return;
    const next: Record<number, number> = {};
    for (const row of savedCustomQuery.data) {
      if (row.sessionType === sessionType) next[row.customStatId] = row.value;
    }
    setCustomValues(next);
  }, [savedCustomQuery.data, sessionType, customTouched]);

  // If settings can't load, fall back to every built-in stat (the original form).
  const enabled = new Set<string>(settingsQuery.data?.enabledBuiltinStats ?? BUILTIN_STAT_KEYS);
  const visibleBuiltins = BUILTIN_STATS.filter((s) => enabled.has(s.key));
  const customStats = settingsQuery.data?.customStats ?? [];

  const utils = trpc.useUtils();
  const logSession = trpc.wwld.logSession.useMutation({
    onSuccess: () => {
      // Invalidate ALL wwld queries so every tab and chart refreshes immediately
      utils.wwld.getToday.invalidate();
      utils.wwld.getTodayStatus.invalidate();
      utils.wwld.getStats.invalidate();
      utils.wwld.getAnalytics.invalidate();
      utils.wwld.getCustomStatValues.invalidate();
      utils.wwld.getHistory.invalidate();
      setSubmitted(true);
      setTimeout(() => {
        onSuccess?.();
      }, 1200);
    },
  });

  const adjust = (key: BuiltinStatKey, delta: number) => {
    setValues((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(BUILTIN_MAX, prev[key] + delta)),
    }));
  };

  const handleDirectInput = (key: BuiltinStatKey, raw: string) => {
    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      setValues((prev) => ({ ...prev, [key]: Math.max(0, Math.min(BUILTIN_MAX, num)) }));
    } else if (raw === "") {
      setValues((prev) => ({ ...prev, [key]: 0 }));
    }
  };

  const adjustCustom = (id: number, delta: number) => {
    setCustomTouched(true);
    setCustomValues((prev) => ({
      ...prev,
      [id]: Math.max(0, Math.min(CUSTOM_STAT_VALUE_MAX, (prev[id] ?? 0) + delta)),
    }));
  };

  const handleCustomInput = (id: number, raw: string) => {
    setCustomTouched(true);
    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      setCustomValues((prev) => ({ ...prev, [id]: Math.max(0, Math.min(CUSTOM_STAT_VALUE_MAX, num)) }));
    } else if (raw === "") {
      setCustomValues((prev) => ({ ...prev, [id]: 0 }));
    }
  };

  const handleSubmit = () => {
    // Only send the stats this doctor tracks. Unchecked stats are left untouched on the server.
    const builtinPayload: Partial<StatValues> = {};
    for (const stat of visibleBuiltins) builtinPayload[stat.key] = values[stat.key];
    logSession.mutate({
      sessionDate,
      sessionType,
      ...builtinPayload,
      customStats: customStats.map((stat) => ({ customStatId: stat.id, value: customValues[stat.id] ?? 0 })),
    });
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <CheckCircle2 className="w-12 h-12 text-[var(--gold)]" />
        <p className="text-lg font-semibold text-foreground">Stats logged!</p>
      </div>
    );
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderRow = (
    key: string,
    label: string,
    sublabel: string | null,
    value: number,
    onMinus: () => void,
    onPlus: () => void,
    onInput: (raw: string) => void,
    max: number,
  ) => (
    <div
      key={key}
      className="flex items-center justify-between bg-card border border-brand-gold/15 rounded-xl px-4 py-3"
    >
      <div className="flex flex-col min-w-0 pr-2">
        <span className="text-sm font-semibold text-foreground truncate">{label}</span>
        {sublabel ? <span className="text-xs text-muted-foreground truncate">{sublabel}</span> : null}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onMinus}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="w-4 h-4 text-foreground" />
        </button>
        <input
          type="number"
          min={0}
          max={max}
          value={value}
          onChange={(e) => onInput(e.target.value)}
          aria-label={label}
          className="w-16 text-center text-lg font-bold text-foreground bg-transparent border-b border-brand-gold/15 focus:outline-none focus:border-[var(--gold)]"
        />
        <button
          type="button"
          onClick={onPlus}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
          aria-label={`Increase ${label}`}
        >
          <Plus className="w-4 h-4 text-foreground" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-foreground">
          {SESSION_LABELS[sessionType]}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{sessionDate}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 max-h-[55vh] overflow-y-auto">
        {visibleBuiltins.map((field) =>
          renderRow(
            field.key,
            field.label,
            field.alias,
            values[field.key],
            () => adjust(field.key, -1),
            () => adjust(field.key, 1),
            (raw) => handleDirectInput(field.key, raw),
            BUILTIN_MAX,
          )
        )}
        {customStats.map((stat) =>
          renderRow(
            `custom-${stat.id}`,
            stat.name,
            stat.unit ? `Custom · ${stat.unit}` : "Custom",
            customValues[stat.id] ?? 0,
            () => adjustCustom(stat.id, -1),
            () => adjustCustom(stat.id, 1),
            (raw) => handleCustomInput(stat.id, raw),
            CUSTOM_STAT_VALUE_MAX,
          )
        )}
      </div>

      <Link
        href="/wwld/settings"
        className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-[var(--gold)] transition-colors"
      >
        <Settings2 className="w-3.5 h-3.5" />
        Choose which stats appear here
      </Link>

      <div className="flex gap-3 mt-2">
        {onCancel && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={logSession.isPending}
          >
            Cancel
          </Button>
        )}
        <Button
          className="flex-1 bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-bold"
          onClick={handleSubmit}
          disabled={logSession.isPending}
        >
          {logSession.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          Log Stats
        </Button>
      </div>

      {logSession.isError && (
        <p className="text-sm text-destructive text-center">
          {logSession.error?.data?.code === "BAD_REQUEST" && logSession.error.message
            ? logSession.error.message
            : "Failed to save. Please try again."}
        </p>
      )}
    </div>
  );
}
