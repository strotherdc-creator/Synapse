/**
 * This week vs your goals — the week so far (Mon–Sun, New York calendar) compared with the full
 * week's goal, then each day's logged numbers. Weekly/monthly "Log Past Stats" totals count in the
 * week total but never in a single day.
 */
import { Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PeriodCard, shortDate, weekdayShort } from "@/components/goals/GoalsComparison";
import { formatMetricValue, type WeekDayRow } from "@shared/goalsComparison";

const DAY_TYPE_TEXT = { full: "full day", half: "half day", off: "day off" } as const;

function DayLine({ day, enabled }: { day: WeekDayRow; enabled: Set<string> }) {
  const parts: string[] = [];
  if (enabled.has("officeVisits") && day.officeVisits.logged) parts.push(`${formatMetricValue("officeVisits", day.officeVisits.value)} visits`);
  if (enabled.has("newPatients") && day.newPatients.logged) parts.push(`${formatMetricValue("newPatients", day.newPatients.value)} new patients`);
  if (enabled.has("revenue") && day.revenue.logged) parts.push(formatMetricValue("revenue", day.revenue.value));
  const anyLogged = day.officeVisits.logged || day.newPatients.logged || day.revenue.logged;
  const right = day.future
    ? "Not here yet"
    : parts.length > 0
      ? parts.join(" · ")
      : anyLogged
        ? "Logged (no goal stats)"
        : day.dayType === "off"
          ? "Day off · no daily goal"
          : "No stats logged";
  const muted = day.future || parts.length === 0;
  return (
    <li className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border py-2" data-date={day.date}>
      <span className="text-base font-semibold text-foreground">
        {weekdayShort(day.date)} {shortDate(day.date)} <span className="font-normal text-muted-foreground">· {DAY_TYPE_TEXT[day.dayType]}</span>
      </span>
      <span className={`text-base tabular-nums ${muted ? "text-muted-foreground" : "font-semibold text-foreground"}`}>{right}</span>
    </li>
  );
}

export default function GoalsWeek() {
  const query = trpc.goals.getComparison.useQuery(undefined, { staleTime: 30_000 });
  const data = query.data;
  const week = data?.periods.find((p) => p.period === "week");
  // Which goal metrics are tracked (a stat unchecked in Log Stats shows "Not tracked" above).
  const enabled = new Set<string>((week?.metrics ?? []).filter((m) => m.result.status !== "not_tracked").map((m) => m.metric));

  return (
    <div className="readable min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b border-brand-gold/15 bg-background px-3 py-3 sm:px-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href="/goals"
            aria-label="Back to Goals"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">This week vs your goals</h1>
            {data && data.week.length === 7 ? (
              <p className="text-base text-muted-foreground">
                {weekdayShort(data.week[0].date)} {shortDate(data.week[0].date)} – {weekdayShort(data.week[6].date)} {shortDate(data.week[6].date)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-3 py-5 sm:px-4">
        {query.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : query.isError || !data || !week ? (
          <p className="py-8 text-center text-base text-destructive">Could not load this week. Please refresh.</p>
        ) : (
          <>
            <PeriodCard period={week} titleOverride="This week so far" />
            <section className="rounded-xl border border-brand-gold/15 bg-card p-4" aria-labelledby="week-days-heading">
              <h2 id="week-days-heading" className="text-xl font-bold text-foreground">
                Day by day
              </h2>
              <p className="text-base text-muted-foreground">What you logged each day. Weekly or monthly totals from Log Past Stats count in the week, not in a day.</p>
              <ul className="mt-2">
                {data.week.map((d) => (
                  <DayLine key={d.date} day={d} enabled={enabled} />
                ))}
              </ul>
            </section>
            <p className="text-base text-muted-foreground">The week's goal is your yearly goal ÷ weeks worked, from your Goals page.</p>
          </>
        )}
      </div>
    </div>
  );
}
