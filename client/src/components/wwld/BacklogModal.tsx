import { useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { History, ChevronRight, ChevronLeft, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { friendlyErrorMessage } from "@/lib/friendlyError";
import { BUILTIN_STAT_KEYS, CUSTOM_STAT_VALUE_MAX } from "@shared/wwldStats";

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionType = "morning" | "afternoon" | "end_of_day";
type EntryMode = "pick" | "by-day" | "week-total" | "month-total";

interface StatValues {
  officeVisits: number;
  newPatients: number;
  recall: number;
  testResults: number;
  progressExams: number;
  performanceReviews: number;
  carePlansSigned: number;
}

const EMPTY_STATS: StatValues = {
  officeVisits: 0,
  newPatients: 0,
  recall: 0,
  testResults: 0,
  progressExams: 0,
  performanceReviews: 0,
  carePlansSigned: 0,
};

function sessionToStats(session: Partial<StatValues>): StatValues {
  return {
    officeVisits: session.officeVisits ?? 0,
    newPatients: session.newPatients ?? 0,
    recall: session.recall ?? 0,
    testResults: session.testResults ?? 0,
    progressExams: session.progressExams ?? 0,
    performanceReviews: session.performanceReviews ?? 0,
    carePlansSigned: session.carePlansSigned ?? 0,
  };
}

const STAT_LABELS: { key: keyof StatValues; label: string; short: string }[] = [
  { key: "officeVisits", label: "Office Visits", short: "Visits" },
  { key: "newPatients", label: "New Patients (Day 1s)", short: "Day 1s" },
  { key: "recall", label: "Recall", short: "Recall" },
  { key: "testResults", label: "Test Results (Day 2s)", short: "Day 2s" },
  { key: "progressExams", label: "Progress Exams", short: "Progress" },
  { key: "performanceReviews", label: "Performance Reviews", short: "Perf Rev" },
  { key: "carePlansSigned", label: "Care Plans Signed", short: "Care Plans" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDayLabel(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
}

function getWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[weekStart.getMonth()]} ${weekStart.getDate()} – ${months[end.getMonth()]} ${end.getDate()}`;
}

function getMonthLabel(year: number, month: number): string {
  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  return `${months[month]} ${year}`;
}

/** Returns the last N calendar days (excluding today) */
function getPastDays(n: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 1; i <= n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }
  return days;
}

/** Returns week start dates (Monday) for the last 4 complete weeks */
function getPastWeeks(): Date[] {
  const weeks: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Find last Monday
  const dayOfWeek = today.getDay(); // 0=Sun
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - daysToLastMonday - 7); // start from the week before current
  for (let i = 0; i < 4; i++) {
    const w = new Date(lastMonday);
    w.setDate(lastMonday.getDate() - i * 7);
    weeks.push(w);
  }
  return weeks;
}

/** Returns last 3 months (year, month 0-indexed) */
function getPastMonths(): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = [];
  const today = new Date();
  for (let i = 1; i <= 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    result.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  return result;
}

// ─── Stat Input Row ───────────────────────────────────────────────────────────

function StatRow({
  label,
  value,
  onChange,
  compact = false,
  max = 9999,
}: {
  label: string;
  value: number | "";
  onChange: (v: number) => void;
  compact?: boolean;
  max?: number;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", compact ? "py-1" : "py-2")}>
      <span className={cn("text-foreground", compact ? "text-xs" : "text-sm")}>{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(0, (value === "" ? 0 : value) - 1))}
          className="w-7 h-7 rounded-md bg-muted/40 hover:bg-muted/70 text-foreground flex items-center justify-center text-base font-bold transition-colors"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          type="number"
          min={0}
          max={max}
          value={value}
          placeholder="–"
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 0 && v <= max) onChange(v);
          }}
          className="w-14 text-center bg-muted/20 border border-brand-gold/15 rounded-md text-foreground text-sm py-1 focus:outline-none focus:ring-1 focus:ring-[var(--gold)]"
        />
        <button
          onClick={() => onChange(Math.min(max, (value === "" ? 0 : value) + 1))}
          className="w-7 h-7 rounded-md bg-muted/40 hover:bg-muted/70 text-foreground flex items-center justify-center text-base font-bold transition-colors"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Doctor's Log Stats settings (shared by every entry mode) ────────────────

/** Built-in fields the doctor checked + their active custom stats. Falls back to all built-ins. */
function useStatFieldConfig() {
  const settingsQuery = trpc.wwld.getStatSettings.useQuery(undefined, { staleTime: 60_000 });
  const enabled = new Set<string>(settingsQuery.data?.enabledBuiltinStats ?? BUILTIN_STAT_KEYS);
  return {
    builtinFields: STAT_LABELS.filter((field) => enabled.has(field.key)),
    customStats: settingsQuery.data?.customStats ?? [],
    isLoading: settingsQuery.isLoading,
  };
}

type CustomDraft = { values: Record<number, number>; touched: Set<number> };
const EMPTY_CUSTOM: CustomDraft = { values: {}, touched: new Set() };

/**
 * Build the logSession payload: only the doctor's checked built-in stats (unchecked stats
 * are left untouched on the server, never zeroed) and only custom stats they actually entered.
 */
function buildLogPayload(
  stats: StatValues,
  builtinFields: Array<{ key: keyof StatValues }>,
  customStats: Array<{ id: number }>,
  custom: CustomDraft,
) {
  const builtin: Partial<StatValues> = {};
  for (const { key } of builtinFields) builtin[key] = stats[key];
  return {
    ...builtin,
    customStats: customStats
      .filter((stat) => custom.touched.has(stat.id))
      .map((stat) => ({ customStatId: stat.id, value: custom.values[stat.id] ?? 0 })),
  };
}

function StatFields({
  builtinFields,
  stats,
  setStats,
  customStats,
  custom,
  setCustom,
}: {
  builtinFields: Array<{ key: keyof StatValues; label: string }>;
  stats: StatValues;
  setStats: (updater: (s: StatValues) => StatValues) => void;
  customStats: Array<{ id: number; name: string; unit: string | null }>;
  custom: CustomDraft;
  setCustom: (updater: (c: CustomDraft) => CustomDraft) => void;
}) {
  return (
    <div className="divide-y divide-border">
      {builtinFields.map(({ key, label }) => (
        <StatRow
          key={key}
          label={label}
          value={stats[key]}
          onChange={(v) => setStats((s) => ({ ...s, [key]: v }))}
        />
      ))}
      {customStats.map((stat) => (
        <StatRow
          key={`custom-${stat.id}`}
          label={stat.unit ? `${stat.name} (${stat.unit})` : stat.name}
          value={custom.values[stat.id] ?? ""}
          max={CUSTOM_STAT_VALUE_MAX}
          onChange={(v) =>
            setCustom((c) => ({
              values: { ...c.values, [stat.id]: v },
              touched: new Set(c.touched).add(stat.id),
            }))
          }
        />
      ))}
    </div>
  );
}

function SaveError({ error }: { error: Parameters<typeof friendlyErrorMessage>[0] }) {
  if (!error) return null;
  return (
    <p className="text-sm text-destructive text-center">
      {friendlyErrorMessage(error, "Those stats didn't save. Please try again.")}
    </p>
  );
}

// ─── By-Day Entry ─────────────────────────────────────────────────────────────

function ByDayEntry({ onDone }: { onDone: () => void }) {
  const days = getPastDays(30);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [stats, setStats] = useState<StatValues>({ ...EMPTY_STATS });
  const [savedDays, setSavedDays] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [custom, setCustom] = useState<CustomDraft>(EMPTY_CUSTOM);
  const fields = useStatFieldConfig();

  const utils = trpc.useUtils();
  const selectedDate = selectedDay ? formatDate(selectedDay) : "2000-01-01";
  const savedCustomQuery = trpc.wwld.getCustomStatValues.useQuery(
    { date: selectedDate },
    { enabled: Boolean(selectedDay), staleTime: 0 },
  );
  const selectedDayQuery = trpc.wwld.getToday.useQuery(
    { date: selectedDate },
    { enabled: Boolean(selectedDay), staleTime: 0 },
  );
  const existingEndOfDay = selectedDayQuery.data?.sessions.find((session) => session.sessionType === "end_of_day");
  const isEditingSavedDay = Boolean(existingEndOfDay);

  useEffect(() => {
    if (selectedDay && existingEndOfDay) {
      setStats(sessionToStats(existingEndOfDay));
    }
  }, [selectedDay, existingEndOfDay]);

  // Pre-fill custom values already saved for this day's end-of-day entry (shown, not re-sent unless changed).
  useEffect(() => {
    if (!selectedDay || !savedCustomQuery.data) return;
    const values: Record<number, number> = {};
    for (const row of savedCustomQuery.data) {
      if (row.sessionType === "end_of_day") values[row.customStatId] = row.value;
    }
    setCustom((c) => (c.touched.size > 0 ? c : { values, touched: new Set() }));
  }, [selectedDay, savedCustomQuery.data]);

  const selectDay = useCallback((day: Date) => {
    setStats({ ...EMPTY_STATS });
    setCustom(EMPTY_CUSTOM);
    setSelectedDay(day);
  }, []);

  const logSession = trpc.wwld.logSession.useMutation({
    onSuccess: () => {
      utils.wwld.getToday.invalidate();
      utils.wwld.getStats.invalidate();
      utils.wwld.getTodayStatus.invalidate();
      utils.wwld.getAnalytics.invalidate();
      utils.wwld.getHistory.invalidate();
      utils.wwld.getCustomStatValues.invalidate();
    },
  });

  const handleSaveDay = useCallback(async () => {
    if (!selectedDay) return;
    setSaving(true);
    try {
      await logSession.mutateAsync({
        sessionDate: selectedDate,
        sessionType: "end_of_day" as SessionType,
        ...buildLogPayload(stats, fields.builtinFields, fields.customStats, custom),
      });
      setSavedDays((prev) => new Set(prev).add(selectedDate));
      setSelectedDay(null);
      setStats({ ...EMPTY_STATS });
      setCustom(EMPTY_CUSTOM);
    } catch {
      // Error message is shown below the form (SaveError).
    } finally {
      setSaving(false);
    }
  }, [selectedDay, selectedDate, stats, custom, fields.builtinFields, fields.customStats, logSession]);

  if (selectedDay) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => { setSelectedDay(null); setStats({ ...EMPTY_STATS }); setCustom(EMPTY_CUSTOM); }}
          className="flex items-center gap-1 text-sm text-[var(--gold)] hover:opacity-80"
        >
          <ChevronLeft className="w-4 h-4" /> Back to day list
        </button>
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">{getDayLabel(selectedDay)}</p>
          <p className="text-xs text-muted-foreground">
            {selectedDayQuery.isLoading
              ? "Loading saved totals..."
              : isEditingSavedDay
                ? "Edit saved totals — change only the number that is wrong"
                : "Enter totals for the full day"}
          </p>
        </div>
        <StatFields
          builtinFields={fields.builtinFields}
          stats={stats}
          setStats={setStats}
          customStats={fields.customStats}
          custom={custom}
          setCustom={setCustom}
        />
        <Button
          onClick={handleSaveDay}
          disabled={saving || selectedDayQuery.isLoading || fields.isLoading}
          className="w-full bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-bold"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          {isEditingSavedDay ? "Save changes to" : "Save"} {getDayLabel(selectedDay)}
        </Button>
        <SaveError error={logSession.error} />
      </div>
    );
  }

  // Group days by week for display
  const thisWeekDays = days.slice(0, 7);
  const olderDays = days.slice(7);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground text-center">Tap a day to enter its stats. Days with a checkmark are already saved.</p>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">This Past Week</p>
        <div className="grid grid-cols-1 gap-1">
          {thisWeekDays.map((d) => {
            const key = formatDate(d);
            const saved = savedDays.has(key);
            return (
              <button
                key={key}
                onClick={() => selectDay(d)}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors text-left",
                  saved
                    ? "border-[var(--gold)]/40 bg-[var(--gold)]/10"
                    : "border-brand-gold/15 bg-card hover:border-[var(--gold)]/50 hover:bg-[var(--gold)]/5"
                )}
              >
                <span className="text-sm font-medium text-foreground">{getDayLabel(d)}</span>
                <div className="flex items-center gap-2">
                  {saved && <CheckCircle2 className="w-4 h-4 text-[var(--gold)]" />}
                  {!saved && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {olderDays.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Older (up to 30 days)</p>
          <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto">
            {olderDays.map((d) => {
              const key = formatDate(d);
              const saved = savedDays.has(key);
              return (
                <button
                  key={key}
                  onClick={() => selectDay(d)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg border transition-colors text-left",
                    saved
                      ? "border-[var(--gold)]/40 bg-[var(--gold)]/10"
                      : "border-brand-gold/15 bg-card hover:border-[var(--gold)]/50 hover:bg-[var(--gold)]/5"
                  )}
                >
                  <span className="text-sm text-foreground">{getDayLabel(d)}</span>
                  <div className="flex items-center gap-2">
                    {saved && <CheckCircle2 className="w-4 h-4 text-[var(--gold)]" />}
                    {!saved && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Button variant="outline" onClick={onDone} className="w-full">
        Done
      </Button>
    </div>
  );
}

// ─── Week Total Entry ─────────────────────────────────────────────────────────

function WeekTotalEntry({ onDone }: { onDone: () => void }) {
  const weeks = getPastWeeks();
  const [selectedWeek, setSelectedWeek] = useState<Date | null>(null);
  const [stats, setStats] = useState<StatValues>({ ...EMPTY_STATS });
  const [savedWeeks, setSavedWeeks] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [custom, setCustom] = useState<CustomDraft>(EMPTY_CUSTOM);
  const fields = useStatFieldConfig();

  const utils = trpc.useUtils();
  const logSession = trpc.wwld.logSession.useMutation({
    onSuccess: () => {
      utils.wwld.getToday.invalidate();
      utils.wwld.getStats.invalidate();
      utils.wwld.getTodayStatus.invalidate();
      utils.wwld.getAnalytics.invalidate();
      utils.wwld.getHistory.invalidate();
      utils.wwld.getCustomStatValues.invalidate();
    },
  });

  // For week totals, we log a single "end_of_day" session on the Monday of that week
  const handleSaveWeek = useCallback(async () => {
    if (!selectedWeek) return;
    setSaving(true);
    try {
      await logSession.mutateAsync({
        sessionDate: formatDate(selectedWeek),
        sessionType: "end_of_day" as SessionType,
        ...buildLogPayload(stats, fields.builtinFields, fields.customStats, custom),
        notes: "Weekly total (backlog entry)",
      });
      setSavedWeeks((prev) => new Set(prev).add(formatDate(selectedWeek)));
      setSelectedWeek(null);
      setStats({ ...EMPTY_STATS });
      setCustom(EMPTY_CUSTOM);
    } catch {
      // Error message is shown below the form (SaveError).
    } finally {
      setSaving(false);
    }
  }, [selectedWeek, stats, custom, fields.builtinFields, fields.customStats, logSession]);

  if (selectedWeek) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => { setSelectedWeek(null); setStats({ ...EMPTY_STATS }); setCustom(EMPTY_CUSTOM); }}
          className="flex items-center gap-1 text-sm text-[var(--gold)] hover:opacity-80"
        >
          <ChevronLeft className="w-4 h-4" /> Back to week list
        </button>
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">Week of {getWeekLabel(selectedWeek)}</p>
          <p className="text-xs text-muted-foreground">Enter the total for the entire week</p>
        </div>
        <StatFields
          builtinFields={fields.builtinFields}
          stats={stats}
          setStats={setStats}
          customStats={fields.customStats}
          custom={custom}
          setCustom={setCustom}
        />
        <Button
          onClick={handleSaveWeek}
          disabled={saving || fields.isLoading}
          className="w-full bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-bold"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          Save Week of {getWeekLabel(selectedWeek)}
        </Button>
        <SaveError error={logSession.error} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground text-center">Select a week and enter the total for all 5 days combined.</p>
      <div className="grid grid-cols-1 gap-2">
        {weeks.map((w) => {
          const key = formatDate(w);
          const saved = savedWeeks.has(key);
          return (
            <button
              key={key}
              onClick={() => { setSelectedWeek(w); setStats({ ...EMPTY_STATS }); setCustom(EMPTY_CUSTOM); }}
              className={cn(
                "flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left",
                saved
                  ? "border-[var(--gold)]/40 bg-[var(--gold)]/10"
                  : "border-brand-gold/15 bg-card hover:border-[var(--gold)]/50 hover:bg-[var(--gold)]/5"
              )}
            >
              <div>
                <p className="text-sm font-semibold text-foreground">Week of {getWeekLabel(w)}</p>
                <p className="text-xs text-muted-foreground">Mon – Sun</p>
              </div>
              <div className="flex items-center gap-2">
                {saved && <CheckCircle2 className="w-4 h-4 text-[var(--gold)]" />}
                {!saved && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>
          );
        })}
      </div>
      <Button variant="outline" onClick={onDone} className="w-full">
        Done
      </Button>
    </div>
  );
}

// ─── Month Total Entry ────────────────────────────────────────────────────────

function MonthTotalEntry({ onDone }: { onDone: () => void }) {
  const months = getPastMonths();
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | null>(null);
  const [stats, setStats] = useState<StatValues>({ ...EMPTY_STATS });
  const [savedMonths, setSavedMonths] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [custom, setCustom] = useState<CustomDraft>(EMPTY_CUSTOM);
  const fields = useStatFieldConfig();

  const utils = trpc.useUtils();
  const logSession = trpc.wwld.logSession.useMutation({
    onSuccess: () => {
      utils.wwld.getToday.invalidate();
      utils.wwld.getStats.invalidate();
      utils.wwld.getTodayStatus.invalidate();
      utils.wwld.getAnalytics.invalidate();
      utils.wwld.getHistory.invalidate();
      utils.wwld.getCustomStatValues.invalidate();
    },
  });

  // Log on the 1st of the month as a monthly total marker
  const handleSaveMonth = useCallback(async () => {
    if (!selectedMonth) return;
    setSaving(true);
    const dateStr = `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, "0")}-01`;
    const key = `${selectedMonth.year}-${selectedMonth.month}`;
    try {
      await logSession.mutateAsync({
        sessionDate: dateStr,
        sessionType: "end_of_day" as SessionType,
        ...buildLogPayload(stats, fields.builtinFields, fields.customStats, custom),
        notes: "Monthly total (backlog entry)",
      });
      setSavedMonths((prev) => new Set(prev).add(key));
      setSelectedMonth(null);
      setStats({ ...EMPTY_STATS });
      setCustom(EMPTY_CUSTOM);
    } catch {
      // Error message is shown below the form (SaveError).
    } finally {
      setSaving(false);
    }
  }, [selectedMonth, stats, custom, fields.builtinFields, fields.customStats, logSession]);

  if (selectedMonth) {
    const label = getMonthLabel(selectedMonth.year, selectedMonth.month);
    return (
      <div className="space-y-3">
        <button
          onClick={() => { setSelectedMonth(null); setStats({ ...EMPTY_STATS }); setCustom(EMPTY_CUSTOM); }}
          className="flex items-center gap-1 text-sm text-[var(--gold)] hover:opacity-80"
        >
          <ChevronLeft className="w-4 h-4" /> Back to month list
        </button>
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">Enter the total for the entire month</p>
        </div>
        <StatFields
          builtinFields={fields.builtinFields}
          stats={stats}
          setStats={setStats}
          customStats={fields.customStats}
          custom={custom}
          setCustom={setCustom}
        />
        <Button
          onClick={handleSaveMonth}
          disabled={saving || fields.isLoading}
          className="w-full bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-bold"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          Save {label}
        </Button>
        <SaveError error={logSession.error} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground text-center">Select a month and enter the total for all working days combined.</p>
      <div className="grid grid-cols-1 gap-2">
        {months.map(({ year, month }) => {
          const key = `${year}-${month}`;
          const saved = savedMonths.has(key);
          const label = getMonthLabel(year, month);
          return (
            <button
              key={key}
              onClick={() => { setSelectedMonth({ year, month }); setStats({ ...EMPTY_STATS }); setCustom(EMPTY_CUSTOM); }}
              className={cn(
                "flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left",
                saved
                  ? "border-[var(--gold)]/40 bg-[var(--gold)]/10"
                  : "border-brand-gold/15 bg-card hover:border-[var(--gold)]/50 hover:bg-[var(--gold)]/5"
              )}
            >
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <div className="flex items-center gap-2">
                {saved && <CheckCircle2 className="w-4 h-4 text-[var(--gold)]" />}
                {!saved && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>
          );
        })}
      </div>
      <Button variant="outline" onClick={onDone} className="w-full">
        Done
      </Button>
    </div>
  );
}

// ─── Mode Picker ──────────────────────────────────────────────────────────────

function ModePicker({ onSelect }: { onSelect: (mode: Exclude<EntryMode, "pick">) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground text-center">How would you like to enter your past stats?</p>

      <button
        onClick={() => onSelect("by-day")}
        className="w-full flex items-center justify-between px-4 py-4 rounded-xl border border-brand-gold/15 bg-card hover:border-[var(--gold)]/50 hover:bg-[var(--gold)]/5 transition-colors text-left"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">By Day</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pick specific days from the past 30 days and enter each day's totals</p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 ml-3" />
      </button>

      <button
        onClick={() => onSelect("week-total")}
        className="w-full flex items-center justify-between px-4 py-4 rounded-xl border border-brand-gold/15 bg-card hover:border-[var(--gold)]/50 hover:bg-[var(--gold)]/5 transition-colors text-left"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">Weekly Total</p>
          <p className="text-xs text-muted-foreground mt-0.5">Enter a single total for an entire week (last 4 weeks available)</p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 ml-3" />
      </button>

      <button
        onClick={() => onSelect("month-total")}
        className="w-full flex items-center justify-between px-4 py-4 rounded-xl border border-brand-gold/15 bg-card hover:border-[var(--gold)]/50 hover:bg-[var(--gold)]/5 transition-colors text-left"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">Monthly Total</p>
          <p className="text-xs text-muted-foreground mt-0.5">Enter a single total for an entire month (last 3 months available)</p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 ml-3" />
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BacklogModal() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<EntryMode>("pick");

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => setMode("pick"), 300); // reset after close animation
  };

  const getTitle = () => {
    switch (mode) {
      case "by-day": return "Log Past Days";
      case "week-total": return "Log a Week Total";
      case "month-total": return "Log a Month Total";
      default: return "Log Past Stats";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 border-[var(--gold)]/30 text-[var(--gold)] hover:bg-[var(--gold)]/10 hover:border-[var(--gold)]/60"
        >
          <History className="w-4 h-4" />
          Log Past Stats
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto bg-background border-brand-gold/15">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--gold)]" />
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          {mode === "pick" && (
            <ModePicker onSelect={setMode} />
          )}
          {mode === "by-day" && (
            <ByDayEntry onDone={() => setMode("pick")} />
          )}
          {mode === "week-total" && (
            <WeekTotalEntry onDone={() => setMode("pick")} />
          )}
          {mode === "month-total" && (
            <MonthTotalEntry onDone={() => setMode("pick")} />
          )}

          {mode !== "pick" && (
            <button
              onClick={() => setMode("pick")}
              className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              ← Choose a different entry method
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
