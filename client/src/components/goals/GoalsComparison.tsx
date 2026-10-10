/**
 * Goals vs Log Stats — logged numbers next to the goal, with the difference as a percent and
 * in the goal's own units. Straight comparison only: no pace, no projections, no estimates.
 * Up/down is always a sign + arrow + word ("+12% above goal"), never color alone.
 */
import { Link } from "wouter";
import { ArrowDown, ArrowUp, CalendarOff, CircleSlash, EyeOff, Equal, Target } from "lucide-react";
import {
  describeDelta,
  formatMetricValue,
  metricDef,
  PERIOD_GOAL_NOUN,
  PERIOD_TITLES,
  STATUS_TEXT,
  type ComparisonResult,
  type GoalMetricKey,
  type GoalsComparison,
  type MetricComparison,
  type PeriodComparison,
} from "@shared/goalsComparison";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
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
function weekdayLong(key: string) {
  return WEEKDAY_LONG[keyParts(key).dow];
}

const DAY_TYPE_TEXT = { full: "full day", half: "half day", off: "day off" } as const;

/** "Thursday, Oct 8 · full day" / "Mon Oct 5 – Thu Oct 8 so far". */
export function periodSubtitle(p: PeriodComparison): string {
  if (p.period === "day") return `${weekdayLong(p.range.start)}, ${shortDate(p.range.start)} · ${DAY_TYPE_TEXT[p.dayType]}`;
  if (!p.soFar) return `${shortDate(p.range.start)} – ${shortDate(p.range.end)}, ${p.range.start.slice(0, 4)}`;
  if (p.range.start === p.range.end) return `${weekdayShort(p.range.start)} ${shortDate(p.range.start)} so far`;
  return `${p.period === "week" ? `${weekdayShort(p.range.start)} ` : ""}${shortDate(p.range.start)} – ${p.period === "week" ? `${weekdayShort(p.range.end)} ` : ""}${shortDate(p.range.end)} so far`;
}

/** "So far · compared with the full week's goal" (no pro-rating). */
export function soFarNote(p: PeriodComparison): string | null {
  if (!p.soFar) return null;
  if (p.period === "day") return p.dayType === "off" ? null : `So far today · compared with the ${p.dayType === "half" ? "half day's" : "full day's"} goal`;
  return `So far · compared with the ${PERIOD_GOAL_NOUN[p.period]} goal`;
}

function StatusLine({ result }: { result: Exclude<ComparisonResult, { status: "compared" }> }) {
  const Icon = result.status === "day_off" ? CalendarOff : result.status === "not_tracked" ? EyeOff : result.status === "no_goal" ? Target : CircleSlash;
  return (
    <p className="mt-1 flex items-center gap-2 text-base text-foreground">
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span>{STATUS_TEXT[result.status]}</span>
    </p>
  );
}

export function DeltaLine({ metric, diff, pct, compact = false }: { metric: GoalMetricKey; diff: number; pct: number; compact?: boolean }) {
  const d = describeDelta(metric, diff, pct);
  const Icon = d.direction === "above" ? ArrowUp : d.direction === "below" ? ArrowDown : Equal;
  const color = d.direction === "above" ? "text-emerald-300" : d.direction === "below" ? "text-amber-300" : "text-foreground";
  return (
    <p className={`flex flex-wrap items-center gap-x-2 font-semibold ${compact ? "text-base" : "text-lg"} ${color}`} data-direction={d.direction}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="text-xl font-bold tabular-nums">{d.pctText}</span>
      <span>{d.word}</span>
      {d.unitsText ? <span className="tabular-nums">· {d.unitsText}</span> : null}
    </p>
  );
}

function MetricRow({ item }: { item: MetricComparison }) {
  const def = metricDef(item.metric);
  const r = item.result;
  return (
    <div className="border-t border-border py-3" data-metric={item.metric} data-status={r.status}>
      <p className="text-lg font-bold text-foreground">{def.label}</p>
      {r.status === "compared" ? (
        <>
          <dl className="mt-1 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-base text-muted-foreground">Logged</dt>
              <dd className="text-2xl font-bold tabular-nums text-foreground">{formatMetricValue(item.metric, r.actual)}</dd>
            </div>
            <div>
              <dt className="text-base text-muted-foreground">Goal</dt>
              <dd className="text-2xl font-bold tabular-nums text-foreground">{formatMetricValue(item.metric, r.goal)}</dd>
            </div>
          </dl>
          <div className="mt-1">
            <DeltaLine metric={item.metric} diff={r.diff} pct={r.pct} />
          </div>
        </>
      ) : (
        <StatusLine result={r} />
      )}
    </div>
  );
}

export function PeriodCard({ period, titleOverride }: { period: PeriodComparison; titleOverride?: string }) {
  const note = soFarNote(period);
  const title = titleOverride ?? (period.soFar ? PERIOD_TITLES[period.period] : `${period.range.start.slice(0, 4)} total`);
  return (
    <section className="rounded-xl border border-brand-gold/15 bg-card p-4" data-period={period.period} aria-label={title}>
      <h3 className="text-xl font-bold text-foreground">{title}</h3>
      <p className="text-base text-muted-foreground">{periodSubtitle(period)}</p>
      {note ? <p className="mt-1 text-base text-foreground">{note}</p> : null}
      <div className="mt-2">
        {period.metrics.map((m) => (
          <MetricRow key={m.metric} item={m} />
        ))}
      </div>
    </section>
  );
}

const FROM_YEARLY = "Day, week and month goals come from your yearly goal, split the same way as below (no pro-rating).";

/** Top of the Goals page: today, this week, this month, this year. */
export function GoalsSummary({ data }: { data: GoalsComparison }) {
  return (
    <section className="space-y-3" aria-labelledby="goals-vs-stats-heading" data-testid="goals-vs-stats">
      <div className="rounded-xl border-2 border-[var(--gold)] bg-card p-4">
        <h2 id="goals-vs-stats-heading" className="text-lg font-bold text-foreground">
          How you're doing vs your goals
        </h2>
        <p className="mt-1 text-base text-foreground">
          {data.yearMode === "current"
            ? "What you've logged in Log Stats, next to your goal. Today counts as it happens."
            : data.yearMode === "past"
              ? `Everything you logged in ${data.goalYear}, next to your ${data.goalYear} goal.`
              : `${data.goalYear} hasn't started yet, so there's nothing logged to compare.`}
        </p>
        {data.yearMode === "current" ? <p className="mt-1 text-base text-muted-foreground">{FROM_YEARLY}</p> : null}
        {data.yearMode === "current" ? (
          <Link
            href="/goals/week"
            className="mt-2 inline-flex min-h-11 items-center font-semibold text-[var(--gold)] underline underline-offset-4"
          >
            See this week day by day
          </Link>
        ) : null}
      </div>
      {data.periods.map((p) => (
        <PeriodCard key={p.period} period={p} />
      ))}
    </section>
  );
}

function CompactMetric({ item }: { item: MetricComparison }) {
  const def = metricDef(item.metric);
  const r = item.result;
  return (
    <div className="border-t border-border py-2" data-metric={item.metric} data-status={r.status}>
      {r.status === "compared" ? (
        <>
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-base font-semibold text-foreground">{def.label}</span>
            <span className="text-xl font-bold tabular-nums text-foreground">
              {formatMetricValue(item.metric, r.actual)}{" "}
              <span className="text-base font-normal text-muted-foreground">of {formatMetricValue(item.metric, r.goal)}</span>
            </span>
          </p>
          <DeltaLine metric={item.metric} diff={r.diff} pct={r.pct} compact />
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-foreground">{def.label}</p>
          <StatusLine result={r} />
        </>
      )}
    </div>
  );
}

/** Today's Plan: today and this week, with a button to Goals for month and year. */
export function TodayGoalsCard({ data }: { data: GoalsComparison }) {
  const shown = data.periods.filter((p) => p.period === "day" || p.period === "week");
  return (
    <section className="readable rounded-2xl border-2 border-[var(--gold)] bg-card p-4" aria-labelledby="today-goals-heading" data-testid="today-goals-card">
      <h2 id="today-goals-heading" className="text-lg font-bold text-foreground">
        Your stats vs your goals
      </h2>
      {!data.hasGoals ? (
        <p className="mt-2 flex items-center gap-2 text-base text-foreground">
          <Target className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          No goal set
        </p>
      ) : (
        shown.map((p) => {
          const note = soFarNote(p);
          return (
            <div key={p.period} className="mt-3" data-period={p.period}>
              <p className="text-lg font-bold text-foreground">
                {PERIOD_TITLES[p.period]} <span className="text-base font-normal text-muted-foreground">· {periodSubtitle(p)}</span>
              </p>
              {note ? <p className="text-base text-muted-foreground">{note}</p> : null}
              {p.metrics.map((m) => (
                <CompactMetric key={m.metric} item={m} />
              ))}
            </div>
          );
        })
      )}
      <p className="mt-2 text-base text-muted-foreground">Day and week goals come from your yearly goal.</p>
      <div className="mt-3 grid gap-2">
        <Link
          href="/goals"
          className="flex min-h-12 items-center justify-center rounded-lg bg-[var(--gold)] px-4 text-base font-bold text-black"
        >
          {data.hasGoals ? "See month and year on Goals" : "Set your goals"}
        </Link>
        {data.hasGoals ? (
          <Link
            href="/goals/week"
            className="flex min-h-11 items-center justify-center rounded-lg border-2 border-[var(--gold)] px-4 text-base font-semibold text-[var(--gold)]"
          >
            This week day by day
          </Link>
        ) : null}
      </div>
    </section>
  );
}
