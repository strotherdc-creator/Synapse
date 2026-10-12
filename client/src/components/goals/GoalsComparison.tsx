/**
 * Goals vs Log Stats (v2, Doc Oct 10): one period at a time, one simple card per goal.
 * Each card: label, "244 of 250", a thick progress bar, and ONE status line
 * ("6 short · 98% of goal"). Whole numbers only; math uses the unrounded goal.
 * Status is a word + icon, never color alone. No pace, projections or estimates.
 */
import { useState } from "react";
import { Link } from "wouter";
import { ArrowDown, ArrowUp, Check, CircleSlash } from "lucide-react";
import {
  describeProgress,
  displayGoal,
  formatWhole,
  metricDef,
  PERIOD_TABS,
  STATUS_TEXT_V2,
  type GoalsComparison,
  type MetricComparison,
  type PeriodComparison,
  type PeriodKey,
} from "@shared/goalsComparison";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function keyParts(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}
export function shortDate(key: string) {
  const { m, d } = keyParts(key);
  return `${MONTHS[m - 1]} ${d}`;
}
export function weekdayShort(key: string) {
  return WEEKDAY_SHORT[keyParts(key).dow];
}

/** One short line: "Mon Oct 5 – Sun Oct 11 · so far", "Sat Oct 10 · half day · so far", "October · so far". */
export function periodSubtitle(p: PeriodComparison): string {
  const so = p.soFar ? " · so far" : "";
  if (p.period === "day") return `${weekdayShort(p.range.start)} ${shortDate(p.range.start)}${p.dayType === "half" ? " · half day" : ""}${p.dayType === "off" ? "" : so}`;
  if (p.period === "week") return `${weekdayShort(p.fullRange.start)} ${shortDate(p.fullRange.start)} – ${weekdayShort(p.fullRange.end)} ${shortDate(p.fullRange.end)}${so}`;
  if (p.period === "month") return `${MONTHS_LONG[keyParts(p.range.start).m - 1]}${so}`;
  return `${p.range.start.slice(0, 4)}${so}`;
}

export function PeriodTabs({ periods, value, onChange, label }: { periods: PeriodKey[]; value: PeriodKey; onChange: (p: PeriodKey) => void; label: string }) {
  return (
    <div className={`grid gap-2 ${periods.length === 4 ? "grid-cols-4" : "grid-cols-2"}`} role="group" aria-label={label}>
      {periods.map((p) => {
        const on = p === value;
        return (
          <button
            key={p}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(p)}
            className={`min-h-12 rounded-lg border-2 px-1 text-base transition-colors ${
              on
                ? "border-[var(--gold)] bg-[var(--gold)] font-bold text-black underline underline-offset-4"
                : "border-border bg-card font-semibold text-foreground hover:bg-muted"
            }`}
          >
            {PERIOD_TABS[p]}
          </button>
        );
      })}
    </div>
  );
}

export function GoalCard({ item }: { item: MetricComparison }) {
  const def = metricDef(item.metric);
  const r = item.result;
  if (r.status !== "compared") {
    const text = r.status === "day_off" ? "Day off" : STATUS_TEXT_V2[r.status];
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3" data-metric={item.metric} data-status={r.status}>
        <p className="text-base font-semibold text-foreground">{def.label}</p>
        <p className="mt-1 flex items-center gap-2 text-lg text-foreground">
          <CircleSlash className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          {text}
        </p>
      </div>
    );
  }
  const p = describeProgress(item.metric, r.actual, r.goal);
  const Icon = p.state === "ahead" ? ArrowUp : p.state === "short" ? ArrowDown : Check;
  const tone = p.state === "short" ? "text-amber-300" : "text-emerald-300";
  const fill = p.state === "short" ? "bg-amber-300" : "bg-emerald-400";
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3" data-metric={item.metric} data-status={p.state}>
      <p className="text-base font-semibold text-foreground">{def.label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
        {formatWhole(item.metric, r.actual)} <span className="text-xl font-semibold text-muted-foreground">of {formatWhole(item.metric, Math.max(1, displayGoal(item.metric, r.goal)))}</span>
      </p>
      <div
        className="mt-2 h-4 w-full overflow-hidden rounded-full border border-border bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p.barPct)}
        aria-label={`${def.label}: ${p.pctOfGoal}% of goal`}
      >
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${p.barPct}%` }} />
      </div>
      <p className={`mt-2 flex items-center gap-2 text-lg font-semibold ${tone}`}>
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>{p.text}</span>
      </p>
    </div>
  );
}

export function PeriodView({ period }: { period: PeriodComparison }) {
  const dayOff = period.period === "day" && period.metrics.every((m) => m.result.status === "day_off" || m.result.status === "not_tracked");
  return (
    <div data-period={period.period}>
      <p className="text-lg font-semibold text-foreground">{periodSubtitle(period)}</p>
      <div className="mt-3 space-y-3">
        {dayOff ? (
          <p className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-lg text-foreground">
            <CircleSlash className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            Day off
          </p>
        ) : (
          period.metrics.map((m) => <GoalCard key={m.metric} item={m} />)
        )}
      </div>
    </div>
  );
}

/** Top of the Goals page: Today | Week | Month | Year, Week by default. */
export function GoalsSummary({ data }: { data: GoalsComparison }) {
  const available = data.periods.map((p) => p.period);
  const [tab, setTab] = useState<PeriodKey>(available.includes("week") ? "week" : available[0]);
  const period = data.periods.find((p) => p.period === tab) ?? data.periods[0];
  return (
    <section className="space-y-3" aria-labelledby="goals-vs-stats-heading" data-testid="goals-vs-stats">
      <h2 id="goals-vs-stats-heading" className="text-xl font-bold text-foreground">
        Your stats vs your goals
      </h2>
      {available.length > 1 ? <PeriodTabs periods={available} value={tab} onChange={setTab} label="Choose a period" /> : null}
      {data.yearMode === "future" ? (
        <p className="text-lg text-foreground">{data.goalYear} hasn't started yet.</p>
      ) : (
        <PeriodView period={period} />
      )}
      {tab === "week" && data.yearMode === "current" ? (
        <Link href="/goals/week" className="inline-flex min-h-11 items-center text-lg font-semibold text-[var(--gold)] underline underline-offset-4">
          See each day this week
        </Link>
      ) : null}
    </section>
  );
}

/** Today's Plan: compact Today | Week toggle, the same three cards, one button. */
export function TodayGoalsCard({ data }: { data: GoalsComparison }) {
  const [tab, setTab] = useState<PeriodKey>("day");
  const period = data.periods.find((p) => p.period === tab);
  return (
    <section className="readable space-y-3 rounded-2xl border-2 border-[var(--gold)] bg-card p-4" aria-labelledby="today-goals-heading" data-testid="today-goals-card">
      <h2 id="today-goals-heading" className="text-lg font-bold text-foreground">
        Your stats vs your goals
      </h2>
      {!data.hasGoals ? (
        <p className="flex items-center gap-2 text-lg text-foreground">
          <CircleSlash className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          No goal set
        </p>
      ) : (
        <>
          <PeriodTabs periods={["day", "week"]} value={tab} onChange={setTab} label="Today or this week" />
          {period ? <PeriodView period={period} /> : null}
        </>
      )}
      <Link
        href="/goals"
        className="flex min-h-12 items-center justify-center rounded-lg bg-[var(--gold)] px-4 text-base font-bold text-black"
      >
        {data.hasGoals ? "See all on Goals" : "Set your goals"}
      </Link>
    </section>
  );
}
