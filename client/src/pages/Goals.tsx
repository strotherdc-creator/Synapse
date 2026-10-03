import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { friendlyErrorMessage } from "@/lib/friendlyError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Goal, Loader2, Save } from "lucide-react";
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

const BREAKDOWN_ROWS: { key: keyof GoalBreakdown; label: string; hint?: string }[] = [
  { key: "yearly", label: "Year" },
  { key: "monthly", label: "Month", hint: "÷ 12" },
  { key: "weekly", label: "Week", hint: "÷ weeks worked" },
  { key: "fullDay", label: "Full day", hint: "in office" },
  { key: "halfDay", label: "Half day", hint: "in office" },
];

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
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{prefix}</span>
        )}
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`h-11 text-base ${prefix ? "pl-7" : ""}`}
        />
      </div>
      <p className="text-xs text-muted-foreground">{help}</p>
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
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b border-brand-gold/15 px-4 py-4">
        <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <Goal className="w-6 h-6 text-[var(--gold)]" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Goals</h1>
              <p className="text-xs text-muted-foreground">Your year, broken down to a single day</p>
            </div>
          </div>
          <div className="flex items-center gap-1" aria-label="Goal year">
            <button
              type="button"
              onClick={() => changeYear(-1)}
              disabled={!canGoBack}
              className="flex h-11 w-11 disabled:opacity-40 disabled:pointer-events-none items-center justify-center rounded-lg border border-brand-gold/15 text-muted-foreground hover:text-foreground"
              aria-label="Previous year"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="min-w-[3.5rem] text-center text-lg font-bold text-foreground">{year}</span>
            <button
              type="button"
              onClick={() => changeYear(1)}
              disabled={!canGoForward}
              className="flex h-11 w-11 disabled:opacity-40 disabled:pointer-events-none items-center justify-center rounded-lg border border-brand-gold/15 text-muted-foreground hover:text-foreground"
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
                <h2 className="text-sm font-semibold text-foreground">{year} goals</h2>
                <p className="text-xs text-muted-foreground mt-1">Enter your goals for the year. Everything below updates as you type.</p>
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

            {/* PVA + OVA */}
            <section className="grid grid-cols-2 gap-3" data-testid="goal-averages">
              <div className="bg-card border border-brand-gold/15 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold)]">PVA</p>
                <p className="text-2xl font-bold text-foreground mt-1">{formatCount(results.pva)}</p>
                <p className="text-xs text-muted-foreground mt-1">Average visits per new patient</p>
                <p className="text-[11px] text-muted-foreground/80 mt-1">Office visits ÷ new patients</p>
              </div>
              <div className="bg-card border border-brand-gold/15 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold)]">OVA</p>
                <p className="text-2xl font-bold text-foreground mt-1">{formatMoneyCents(results.ova)}</p>
                <p className="text-xs text-muted-foreground mt-1">Average revenue per office visit</p>
                <p className="text-[11px] text-muted-foreground/80 mt-1">Revenue ÷ office visits</p>
              </div>
            </section>

            {/* Breakdown */}
            <section className="bg-card border border-brand-gold/15 rounded-xl p-4 space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">What it takes</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {results.clinicDaysPerYear === null
                    ? "Set at least one clinic day and your weeks worked below to see weekly and daily goals."
                    : `Based on ${dayLabel} × ${results.weeksWorked} weeks = ${formatCount(results.clinicDaysPerYear)} full clinic days a year.`}
                </p>
              </div>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm" data-testid="goal-breakdown">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2 px-1 font-semibold">Per</th>
                      <th className="py-2 px-1 font-semibold text-right">Revenue</th>
                      <th className="py-2 px-1 font-semibold text-right">Visits</th>
                      <th className="py-2 px-1 font-semibold text-right">New pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BREAKDOWN_ROWS.map((row) => {
                      const daily = row.key === "fullDay" || row.key === "halfDay";
                      return (
                        <tr key={row.key} className={`border-t border-brand-gold/10 ${daily ? "bg-[var(--gold)]/5" : ""}`}>
                          <td className="py-2.5 px-1">
                            <div className="font-semibold text-foreground">{row.label}</div>
                            {row.hint && <div className="text-[11px] text-muted-foreground">{row.hint}</div>}
                          </td>
                          <td className="py-2.5 px-1 text-right font-semibold text-foreground tabular-nums">
                            {formatMoney(results.revenue[row.key])}
                          </td>
                          <td className="py-2.5 px-1 text-right text-foreground tabular-nums">
                            {formatCount(results.officeVisits[row.key])}
                          </td>
                          <td className="py-2.5 px-1 text-right text-foreground tabular-nums">
                            {formatCount(results.newPatients[row.key])}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {aim.officeVisits !== null && (
                <p className="text-xs text-muted-foreground">
                  To stay on target, aim for at least <strong className="text-foreground">{aim.officeVisits} visits</strong>
                  {aim.newPatients !== null && (
                    <>
                      {" "}and <strong className="text-foreground">{aim.newPatients} new patient{aim.newPatients === 1 ? "" : "s"}</strong>
                    </>
                  )}{" "}
                  on a full day (rounded up to whole patients).
                </p>
              )}
            </section>

            {/* Clinic schedule */}
            <section className="bg-card border border-brand-gold/15 rounded-xl p-4 space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Clinic days</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  This is the same Practice Schedule as your Profile, so changing it here updates it there too.
                  A half day counts as {HALF_DAY_WEIGHT === 0.5 ? "half" : HALF_DAY_WEIGHT} of a full day.
                </p>
              </div>
              <div className="space-y-2">
                {WEEKDAYS.map((day) => (
                  <div key={day.key} className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground w-12 sm:w-24">
                      <span className="sm:hidden">{day.short}</span>
                      <span className="hidden sm:inline">{day.label}</span>
                    </span>
                    <div className="grid flex-1 grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label={`${day.label} hours`}>
                      {DAY_OPTIONS.map((opt) => {
                        const active = schedule[day.key] === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setSchedule((s) => ({ ...s, [day.key]: opt.value }))}
                            className={`min-h-9 rounded-md px-1 text-xs font-semibold transition-colors ${
                              active
                                ? opt.value === "off"
                                  ? "bg-background text-foreground shadow-sm"
                                  : "bg-[var(--gold)] text-black shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-brand-gold/10 space-y-1">
                <label htmlFor="goal-weeks" className="block text-sm font-semibold text-foreground">
                  Weeks worked per year
                </label>
                <Input
                  id="goal-weeks"
                  inputMode="numeric"
                  value={draft.weeksWorked}
                  onChange={(e) => setDraft((d) => ({ ...d, weeksWorked: e.target.value }))}
                  className="h-11 text-base w-28"
                />
                <p className="text-xs text-muted-foreground">52 minus your weeks off for vacation and holidays. Default is 50.</p>
              </div>
            </section>

            {/* This year so far (Log Stats) */}
            {showProgress && progressQuery.data && (
              <section className="bg-card border border-brand-gold/15 rounded-xl p-4 space-y-3" data-testid="goal-progress">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{year === currentYear ? "This year so far" : `${year} actual`}</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    From what you've logged in Log Stats through {year === currentYear ? "yesterday" : "Dec 31"}, compared with an even pace through the year
                    {year === currentYear ? ` (${formatYearDone(fraction)} of the year done)` : ""}.
                  </p>
                </div>
                {!progressQuery.data.hasData ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing logged for {year} yet. <Link href="/wwld" className="text-[var(--gold)] font-semibold">Log your stats</Link> to track your pace.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Office visits", actual: progressQuery.data.officeVisits, goal: numbers.visits },
                      { label: "New patients", actual: progressQuery.data.newPatients, goal: numbers.newPatients },
                    ].map((m) => {
                      const target = paceTarget(m.goal, fraction);
                      const ahead = target !== null && m.actual >= target;
                      return (
                        <div key={m.label} className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">{m.label}</p>
                          <p className="text-xl font-bold text-foreground">{m.actual.toLocaleString("en-US")}</p>
                          {target === null ? (
                            <p className="text-xs text-muted-foreground">Add a goal to compare</p>
                          ) : (
                            <p className={`text-xs font-semibold ${ahead ? "text-emerald-500" : "text-amber-500"}`}>
                              {ahead ? "On pace" : "Behind pace"} · pace {formatCount(target)}
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
