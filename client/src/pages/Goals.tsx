import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { friendlyErrorMessage } from "@/lib/friendlyError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Goal, Loader2, Save, TrendingUp } from "lucide-react";
import {
  DEFAULT_WEEKS_WORKED,
  HALF_DAY_WEIGHT,
  MAX_GOAL_NEW_PATIENTS,
  MAX_GOAL_REVENUE,
  MAX_GOAL_VISITS,
  MAX_GOAL_YEAR,
  MIN_GOAL_YEAR,
  MAX_WEEKS_WORKED,
  MIN_WEEKS_WORKED,
  WEEKDAYS,
  calculateGoals,
  clampGoalYear,
  fullDayAim,
  formatCount,
  formatMoney,
  formatMoneyCents,
  formatYearDone,
  paceTarget,
  parseClinicSchedule,
  parseGoalInput,
  serializeClinicSchedule,
  yearElapsedFraction,
  type ClinicDayType,
  type ClinicSchedule,
  type GoalBreakdown,
} from "@shared/goals";

type Draft = {
  revenue: string;
  visits: string;
  newPatients: string;
  weeksWorked: string;
};

const EMPTY_DRAFT: Draft = { revenue: "", visits: "", newPatients: "", weeksWorked: String(DEFAULT_WEEKS_WORKED) };

const DAY_OPTIONS: { value: ClinicDayType; label: string }[] = [
  { value: "off", label: "Closed" },
  { value: "half", label: "Half day" },
  { value: "full", label: "Full day" },
];

const BREAKDOWN_ROWS: { key: keyof GoalBreakdown; label: string; hint: string }[] = [
  { key: "yearly", label: "Per year", hint: "Your yearly goals" },
  { key: "monthly", label: "Per month", hint: "Year ÷ 12" },
  { key: "weekly", label: "Per week", hint: "Year ÷ weeks worked" },
  { key: "fullDay", label: "Per full day", hint: "A full day in the office" },
  { key: "halfDay", label: "Per half day", hint: "Half of a full day" },
];

/** One labeled number on its own row (phone-friendly instead of a table cell). */
function MetricRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-t border-border first:border-t-0">
      <dt className="text-base text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums text-right ${strong ? "text-2xl font-bold text-foreground" : "text-xl font-semibold text-foreground"}`}>{value}</dd>
    </div>
  );
}

const toField = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

function todayKeyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function GoalField({
  id,
  label,
  help,
  value,
  onChange,
  prefix,
  placeholder,
}: {
  id: string;
  label: string;
  help: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-base font-semibold text-foreground">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">{prefix}</span>
        )}
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`h-12 text-lg ${prefix ? "pl-8" : ""}`}
        />
      </div>
      <p className="text-base text-muted-foreground">{help}</p>
    </div>
  );
}

export default function Goals() {
  const utils = trpc.useUtils();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(() => clampGoalYear(currentYear));
  const goalsQuery = trpc.goals.get.useQuery({ goalYear: year });
  const progressQuery = trpc.goals.getProgress.useQuery({ goalYear: year });

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [schedule, setSchedule] = useState<ClinicSchedule>(parseClinicSchedule(null));
  const [savedWorkDays, setSavedWorkDays] = useState<string | null>(null);
  const [loadedYear, setLoadedYear] = useState<number | null>(null);

  // Load the saved goals (or empty inputs) each time the year's data arrives.
  useEffect(() => {
    if (!goalsQuery.data || loadedYear === year) return;
    const g = goalsQuery.data.goals;
    setDraft(
      g
        ? {
            revenue: toField(g.yearlyRevenue),
            visits: toField(g.yearlyOfficeVisits),
            newPatients: toField(g.yearlyNewPatients),
            weeksWorked: String(g.weeksWorked ?? DEFAULT_WEEKS_WORKED),
          }
        : EMPTY_DRAFT
    );
    const parsed = parseClinicSchedule(goalsQuery.data.workDays);
    setSchedule(parsed);
    setSavedWorkDays(serializeClinicSchedule(parsed));
    setLoadedYear(year);
  }, [goalsQuery.data, loadedYear, year]);

  const numbers = {
    revenue: parseGoalInput(draft.revenue),
    visits: parseGoalInput(draft.visits),
    newPatients: parseGoalInput(draft.newPatients),
    weeksWorked: parseGoalInput(draft.weeksWorked),
  };

  const results = useMemo(
    () =>
      calculateGoals({
        yearlyRevenue: numbers.revenue,
        yearlyOfficeVisits: numbers.visits,
        yearlyNewPatients: numbers.newPatients,
        weeksWorked: numbers.weeksWorked,
        schedule,
      }),
    [numbers.revenue, numbers.visits, numbers.newPatients, numbers.weeksWorked, schedule]
  );

  const savingRef = useRef(false);
  const saveGoals = trpc.goals.save.useMutation();
  const saving = saveGoals.isPending;

  const fieldError = (() => {
    const bad = (raw: string, n: number | null) => raw.trim() !== "" && n === null;
    if (bad(draft.revenue, numbers.revenue)) return "Revenue goal should be a dollar amount, like 750000.";
    if (bad(draft.visits, numbers.visits)) return "Office visits goal should be a whole number.";
    if (bad(draft.newPatients, numbers.newPatients)) return "New patients goal should be a whole number.";
    if (numbers.revenue !== null && numbers.revenue > MAX_GOAL_REVENUE) return "That revenue goal is too large.";
    if (numbers.visits !== null && numbers.visits > MAX_GOAL_VISITS) return "That office visits goal is too large.";
    if (numbers.newPatients !== null && numbers.newPatients > MAX_GOAL_NEW_PATIENTS) return "That new patients goal is too large.";
    const w = numbers.weeksWorked;
    if (w === null || w < MIN_WEEKS_WORKED || w > MAX_WEEKS_WORKED) return "Weeks worked should be between 1 and 52.";
    return null;
  })();

  const handleSave = async () => {
    if (savingRef.current) return;
    if (fieldError) {
      toast.error(fieldError);
      return;
    }
    savingRef.current = true;
    try {
      // Goals and (if changed) the clinic schedule go in ONE request, saved in one transaction.
      const workDays = serializeClinicSchedule(schedule);
      const scheduleChanged = workDays !== savedWorkDays;
      await saveGoals.mutateAsync({
        goalYear: year,
        yearlyRevenue: numbers.revenue,
        yearlyOfficeVisits: numbers.visits,
        yearlyNewPatients: numbers.newPatients,
        weeksWorked: numbers.weeksWorked ?? DEFAULT_WEEKS_WORKED,
        ...(scheduleChanged ? { workDays } : {}),
      });
      if (scheduleChanged) {
        setSavedWorkDays(workDays);
        utils.auth.me.invalidate();
      }
      await utils.goals.get.invalidate();
      toast.success(`${year} goals saved`);
    } catch (error) {
      toast.error(friendlyErrorMessage(error as never, "Could not save your goals. Please try again."));
    } finally {
      savingRef.current = false;
    }
  };

  const canGoBack = year > MIN_GOAL_YEAR;
  const canGoForward = year < MAX_GOAL_YEAR;
  const changeYear = (delta: number) => {
    const next = clampGoalYear(year + delta);
    if (next === year) return;
    setYear(next);
    setLoadedYear(null);
  };
  const aim = fullDayAim(results);

  const fraction = yearElapsedFraction(year, progressQuery.data?.asOf ?? todayKeyLocal());
  const showProgress = progressQuery.data && fraction > 0 && (numbers.visits !== null || numbers.newPatients !== null);
  const dayLabel =
    results.halfDaysPerWeek > 0
      ? `${results.fullDaysPerWeek} full + ${results.halfDaysPerWeek} half day${results.halfDaysPerWeek === 1 ? "" : "s"} a week`
      : `${results.fullDaysPerWeek} full day${results.fullDaysPerWeek === 1 ? "" : "s"} a week`;

  return (
    <div className="readable min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b border-brand-gold/15 px-4 py-4">
        <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
          <div className="flex min-w-0 items-center gap-2">
            <Goal className="w-6 h-6 shrink-0 text-[var(--gold)]" aria-hidden="true" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Goals</h1>
              <p className="text-base text-muted-foreground">Your year, broken down to a day</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1" aria-label="Goal year">
            <button
              type="button"
              onClick={() => changeYear(-1)}
              disabled={!canGoBack}
              className="flex h-11 w-11 shrink-0 disabled:opacity-40 disabled:pointer-events-none items-center justify-center rounded-lg border border-brand-gold/15 text-muted-foreground hover:text-foreground"
              aria-label="Previous year"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="min-w-[3.5rem] text-center text-lg font-bold text-foreground">{year}</span>
            <button
              type="button"
              onClick={() => changeYear(1)}
              disabled={!canGoForward}
              className="flex h-11 w-11 shrink-0 disabled:opacity-40 disabled:pointer-events-none items-center justify-center rounded-lg border border-brand-gold/15 text-muted-foreground hover:text-foreground"
              aria-label="Next year"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {goalsQuery.isLoading || loadedYear !== year ? (
          goalsQuery.isError ? (
            <p className="text-sm text-destructive text-center py-8">Could not load your goals. Please refresh.</p>
          ) : (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )
        ) : (
          <>
            {/* Yearly goals */}
            <section className="bg-card border border-brand-gold/15 rounded-xl p-4 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">{year} goals</h2>
                <p className="text-base text-muted-foreground mt-1">Enter your goals for the year. Everything below updates as you type.</p>
              </div>
              <GoalField
                id="goal-revenue"
                label="Yearly revenue"
                help="Total collections you want for the year."
                prefix="$"
                placeholder="Enter amount"
                value={draft.revenue}
                onChange={(v) => setDraft((d) => ({ ...d, revenue: v }))}
              />
              <GoalField
                id="goal-visits"
                label="Yearly office visits"
                help="Total patient visits for the year."
                placeholder="Enter visits"
                value={draft.visits}
                onChange={(v) => setDraft((d) => ({ ...d, visits: v }))}
              />
              <GoalField
                id="goal-new-patients"
                label="Yearly new patients"
                help="New patients you want to start care this year."
                placeholder="Enter new patients"
                value={draft.newPatients}
                onChange={(v) => setDraft((d) => ({ ...d, newPatients: v }))}
              />
            </section>

            {/* PVA + OVA: one per row */}
            <section className="space-y-3" data-testid="goal-averages">
              {[
                { tag: "PVA", value: formatCount(results.pva), label: "Average visits per new patient", formula: "Office visits ÷ new patients" },
                { tag: "OVA", value: formatMoneyCents(results.ova), label: "Average revenue per office visit", formula: "Revenue ÷ office visits" },
              ].map((m) => (
                <div key={m.tag} className="bg-card border border-brand-gold/15 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base font-bold tracking-wide text-[var(--gold)]">{m.tag}</p>
                    <p className="text-base text-foreground">{m.label}</p>
                    <p className="text-base text-muted-foreground">{m.formula}</p>
                  </div>
                  <p className="text-3xl font-bold text-foreground tabular-nums shrink-0">{m.value}</p>
                </div>
              ))}
            </section>

            {/* Breakdown: one card per level, one labeled row per number */}
            <section className="space-y-3">
              <div className="px-1">
                <h2 className="text-lg font-bold text-foreground">What it takes</h2>
                <p className="text-base text-muted-foreground mt-1">
                  {results.clinicDaysPerYear === null
                    ? "Set at least one clinic day and your weeks worked below to see weekly and daily goals."
                    : `Based on ${dayLabel} × ${results.weeksWorked} weeks = ${formatCount(results.clinicDaysPerYear)} full clinic days a year.`}
                </p>
              </div>
              <div className="space-y-3" data-testid="goal-breakdown">
                {BREAKDOWN_ROWS.map((row) => {
                  const daily = row.key === "fullDay" || row.key === "halfDay";
                  return (
                    <div
                      key={row.key}
                      className={`rounded-xl border p-4 ${daily ? "bg-[var(--gold)]/10 border-[var(--gold)]" : "bg-card border-brand-gold/15"}`}
                    >
                      <div className="mb-1">
                        <h3 className="text-lg font-bold text-foreground">{row.label}</h3>
                        <p className="text-base text-muted-foreground">{row.hint}</p>
                      </div>
                      <dl>
                        <MetricRow label="Revenue" value={formatMoney(results.revenue[row.key])} strong />
                        <MetricRow label="Office visits" value={formatCount(results.officeVisits[row.key])} />
                        <MetricRow label="New patients" value={formatCount(results.newPatients[row.key])} />
                      </dl>
                    </div>
                  );
                })}
              </div>
              {aim.officeVisits !== null && (
                <p className="rounded-xl border border-[var(--gold)] bg-card p-4 text-base text-foreground">
                  To stay on target, aim for at least <strong>{aim.officeVisits} visits</strong>
                  {aim.newPatients !== null && (
                    <>
                      {" "}and <strong>{aim.newPatients} new patient{aim.newPatients === 1 ? "" : "s"}</strong>
                    </>
                  )}{" "}
                  on a full day (rounded up to whole patients).
                </p>
              )}
            </section>

            {/* Clinic schedule */}
            <section className="bg-card border border-brand-gold/15 rounded-xl p-4 space-y-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">Clinic days</h2>
                <p className="text-base text-muted-foreground mt-1">
                  This is the same Practice Schedule as your Profile, so changing it here updates it there too.
                  A half day counts as {HALF_DAY_WEIGHT === 0.5 ? "half" : HALF_DAY_WEIGHT} of a full day.
                </p>
              </div>
              <div className="space-y-4">
                {WEEKDAYS.map((day) => (
                  <div key={day.key} className="space-y-2">
                    <p className="text-base font-semibold text-foreground" id={`day-${day.key}`}>
                      {day.label}
                    </p>
                    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby={`day-${day.key}`}>
                      {DAY_OPTIONS.map((opt) => {
                        const active = schedule[day.key] === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setSchedule((s) => ({ ...s, [day.key]: opt.value }))}
                            className={`flex min-h-11 items-center justify-center gap-1 rounded-lg border-2 px-1 text-base font-semibold transition-colors ${
                              active
                                ? opt.value === "off"
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-[var(--gold)] bg-[var(--gold)] text-black"
                                : "border-border bg-transparent text-foreground hover:bg-muted"
                            }`}
                          >
                            {active && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-border space-y-2">
                <label htmlFor="goal-weeks" className="block text-base font-semibold text-foreground">
                  Weeks worked per year
                </label>
                <Input
                  id="goal-weeks"
                  inputMode="numeric"
                  value={draft.weeksWorked}
                  onChange={(e) => setDraft((d) => ({ ...d, weeksWorked: e.target.value }))}
                  className="h-12 text-lg w-28"
                />
                <p className="text-base text-muted-foreground">52 minus your weeks off for vacation and holidays. Default is 50.</p>
              </div>
            </section>

            {/* This year so far (Log Stats) */}
            {showProgress && progressQuery.data && (
              <section className="bg-card border border-brand-gold/15 rounded-xl p-4 space-y-3" data-testid="goal-progress">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{year === currentYear ? "This year so far" : `${year} actual`}</h2>
                  <p className="text-base text-muted-foreground mt-1">
                    From what you've logged in Log Stats through {year === currentYear ? "yesterday" : "Dec 31"}, compared with an even pace through the year
                    {year === currentYear ? ` (${formatYearDone(fraction)} of the year done)` : ""}.
                  </p>
                </div>
                {!progressQuery.data.hasData ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing logged for {year} yet. <Link href="/wwld" className="text-[var(--gold)] font-semibold">Log your stats</Link> to track your pace.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {[
                      { label: "Office visits", actual: progressQuery.data.officeVisits, goal: numbers.visits },
                      { label: "New patients", actual: progressQuery.data.newPatients, goal: numbers.newPatients },
                    ].map((m) => {
                      const target = paceTarget(m.goal, fraction);
                      const ahead = target !== null && m.actual >= target;
                      return (
                        <div key={m.label} className="rounded-lg border border-border bg-muted/50 p-4">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-base text-muted-foreground">{m.label}</p>
                            <p className="text-2xl font-bold text-foreground tabular-nums">{m.actual.toLocaleString("en-US")}</p>
                          </div>
                          {target === null ? (
                            <p className="text-base text-muted-foreground mt-1">Add a goal to compare</p>
                          ) : (
                            <p className={`mt-2 flex flex-wrap items-center gap-x-2 text-base font-semibold ${ahead ? "text-emerald-400" : "text-amber-300"}`}>
                              {ahead ? <TrendingUp className="h-5 w-5 shrink-0" aria-hidden="true" /> : <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />}
                              <span>{ahead ? "On pace" : "Behind pace"}</span>
                              <span className="font-normal text-foreground">· pace {formatCount(target)}</span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-12 bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-bold"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {saving ? "Saving..." : `Save ${year} goals`}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
