import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatCard } from "@/components/wwld/StatCard";
import { WeekChart } from "@/components/wwld/WeekChart";

interface DayData {
  date: string;
  officeVisits: number;
  newPatients: number;
  testResults: number;
  progressExams: number;
  performanceReviews: number;
  carePlansSigned: number;
}
import { StatEntryForm } from "@/components/wwld/StatEntryForm";
import { BacklogModal } from "@/components/wwld/BacklogModal";
import { LyleRecommendationCard } from "@/components/wwld/LyleRecommendationCard";
import {
  Plus,
  CheckCircle2,
  Circle,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Lightbulb,
  AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Legend,
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateRange(period: "today" | "wtd" | "mtd" | "ytd"): { start: string; end: string } {
  const today = new Date();
  const end = getTodayDate();
  if (period === "today") return { start: end, end };
  if (period === "wtd") {
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    const start = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    return { start, end };
  }
  if (period === "mtd") {
    const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
    return { start, end };
  }
  return { start: `${today.getFullYear()}-01-01`, end };
}

function fillWeekDays(
  data: Array<DayData>,
  start: string,
  end: string
): DayData[] {
  const result: DayData[] = [];
  const startD = new Date(start + "T00:00:00");
  const endD = new Date(end + "T00:00:00");
  const byDate: Record<string, DayData> = {};
  for (const d of data) byDate[d.date] = d;
  const cur = new Date(startD);
  while (cur <= endD) {
    const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    result.push(byDate[dateStr] ?? { date: dateStr, officeVisits: 0, newPatients: 0, testResults: 0, progressExams: 0, performanceReviews: 0, carePlansSigned: 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatShortDate(dateStr: string): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[new Date(dateStr + "T00:00:00").getDay()];
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return Math.round(((current - prior) / prior) * 100);
}

// ─── Trend Insight Engine ─────────────────────────────────────────────────────

type Insight = {
  type: "positive" | "warning" | "neutral" | "info";
  icon: "up" | "down" | "flat" | "capacity" | "info";
  text: string;
};

type AnalyticsData = {
  last30Days: Array<{ date: string; officeVisits: number; newPatients: number; testResults: number; progressExams: number; performanceReviews: number; carePlansSigned: number }>;
  dayOfWeekAverages: Array<{ day: string; dow: number; scheduleType: "full" | "half" | "off"; avgOfficeVisits: number; avgNewPatients: number; avgCarePlansSigned: number; dataPoints: number }>;
  fullDayOfficeVisitAverage: number | null;
  fullDayDataPoints: number;
  thisWeek: Array<{ date: string; officeVisits: number; newPatients: number; testResults: number; progressExams: number; performanceReviews: number; carePlansSigned: number }>;
  lastWeek: Array<{ date: string; officeVisits: number; newPatients: number; testResults: number; progressExams: number; performanceReviews: number; carePlansSigned: number }>;
  thisMonth: { officeVisits: number; newPatients: number; testResults: number; progressExams: number; performanceReviews: number; carePlansSigned: number };
  lastMonth: { officeVisits: number; newPatients: number; testResults: number; progressExams: number; performanceReviews: number; carePlansSigned: number };
  lastMonthToDate: { officeVisits: number; newPatients: number; testResults: number; progressExams: number; performanceReviews: number; carePlansSigned: number };
  dataQuality: { dailyLoggedDays: number; last30DailyLoggedDays: number; excludedBacklogSessions: number };
};

function generateInsights(analytics: AnalyticsData): Insight[] {
  const insights: Insight[] = [];
  const { last30Days, dayOfWeekAverages, thisWeek, lastWeek, thisMonth, lastMonthToDate, fullDayOfficeVisitAverage, fullDayDataPoints } = analytics;

  if (last30Days.length < 15) {
    return [{ type: "info", icon: "info", text: "Daily trend insights need at least 15 separately logged days in the last 30 days. Weekly or monthly backlog totals are not used as daily activity." }];
  }

  // Compare the current week through today with the same calendar days last week.
  const thisWeekOV = thisWeek.reduce((s, d) => s + d.officeVisits, 0);
  const lastWeekOV = lastWeek.reduce((s, d) => s + d.officeVisits, 0);
  const wowPct = pctChange(thisWeekOV, lastWeekOV);
  if (thisWeek.length >= 2 && lastWeek.length >= 2 && wowPct !== null && Math.abs(wowPct) >= 10) {
    if (wowPct > 0) insights.push({ type: "positive", icon: "up", text: `Office visits are up ${wowPct}% versus the same days last week.` });
    else insights.push({ type: "warning", icon: "down", text: `Office visits are down ${Math.abs(wowPct)}% versus the same days last week.` });
  }

  // Compare month-to-date against the same point in the prior month.
  const momPct = pctChange(thisMonth.newPatients, lastMonthToDate.newPatients);
  if (momPct !== null) {
    if (momPct >= 10) insights.push({ type: "positive", icon: "up", text: `New patients are up ${momPct}% versus the same point last month.` });
    else if (momPct <= -10) insights.push({ type: "warning", icon: "down", text: `New patients are down ${Math.abs(momPct)}% versus the same point last month.` });
  }

  // A shorter scheduled session is not a performance deficit. Half-days use
  // only their own weekday history; full days also have a full-day baseline.
  const comparableDays = dayOfWeekAverages.filter((d) => d.dataPoints >= 4);
  const halfDayBenchmarks = comparableDays.filter((d) => d.scheduleType === "half");
  const fullDayBenchmarks = comparableDays.filter((d) => d.scheduleType === "full");
  if (halfDayBenchmarks.length > 0 || (fullDayBenchmarks.length > 0 && fullDayDataPoints >= 4)) {
    const fullDayText = fullDayOfficeVisitAverage === null
      ? "Full clinic days are compared against their own weekday history."
      : `Full clinic days use a ${fullDayOfficeVisitAverage}-visit full-day baseline and their own weekday history.`;
    const halfDayText = halfDayBenchmarks.length > 0
      ? ` Half-day sessions (${halfDayBenchmarks.map((day) => day.day).join(", ")}) are compared only with the same weekday.`
      : "";
    insights.push({ type: "info", icon: "info", text: `Schedule-aware benchmarks: ${fullDayText}${halfDayText}` });
  }

  // Care plan conversion rate
  const totalNewPts30 = last30Days.reduce((s, d) => s + d.newPatients, 0);
  const totalCarePlans30 = last30Days.reduce((s, d) => s + d.carePlansSigned, 0);
  if (totalNewPts30 >= 5) {
    const ratio = totalCarePlans30 / totalNewPts30;
    if (ratio >= 0.8) insights.push({ type: "positive", icon: "up", text: `Care plan conversion over the last 30 logged days is ${Math.round(ratio * 100)}%.` });
    else if (ratio < 0.5) insights.push({ type: "warning", icon: "down", text: `Care plan conversion over the last 30 logged days is ${Math.round(ratio * 100)}%. Consider reviewing your report of findings presentation.` });
  }

  // Day 2 trend
  if (last30Days.length >= 10) {
    const half = Math.floor(last30Days.length / 2);
    const firstAvg = last30Days.slice(0, half).reduce((s, d) => s + d.testResults, 0) / half;
    const secondAvg = last30Days.slice(half).reduce((s, d) => s + d.testResults, 0) / (last30Days.length - half);
    const trendPct = pctChange(secondAvg, firstAvg);
    if (trendPct !== null && trendPct >= 20) insights.push({ type: "positive", icon: "up", text: `Day 2 (test results) visits are trending up ${trendPct}% over the last 30 days — your pipeline is strengthening.` });
    else if (trendPct !== null && trendPct <= -20) insights.push({ type: "warning", icon: "down", text: `Day 2 (test results) visits are down ${Math.abs(trendPct)}% over 30 days. Follow up with patients who haven't returned.` });
  }

  if (insights.length === 0) insights.push({ type: "info", icon: "info", text: "Keep logging daily stats — insights will appear as your data builds." });
  return insights;
}

// ─── Chart tooltip style ──────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: "oklch(0.18 0.018 155)",
  border: "1px solid oklch(0.26 0.02 155)",
  borderRadius: "8px",
  color: "oklch(0.93 0.01 90)",
  fontSize: "12px",
};

const GOLD = "var(--gold, #d4a017)";
const GREEN = "var(--primary, #2d6a4f)";
const GREEN2 = "oklch(0.55 0.10 155)";

// ─── InsightCard ──────────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: Insight }) {
  const border = { positive: "border-green-500/30 bg-green-500/5", warning: "border-yellow-500/30 bg-yellow-500/5", neutral: "border-blue-500/30 bg-blue-500/5", info: "border-brand-gold/15 bg-muted/30" }[insight.type];
  const iconColor = { positive: "text-green-400", warning: "text-yellow-400", neutral: "text-blue-400", info: "text-muted-foreground" }[insight.type];
  const Icon = { up: TrendingUp, down: TrendingDown, flat: Minus, capacity: Activity, info: Lightbulb }[insight.icon];
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${border}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
      <p className="text-sm text-foreground/90 leading-relaxed">{insight.text}</p>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "today" | "wtd" | "mtd" | "ytd" | "trends";
type SessionType = "morning" | "afternoon" | "end_of_day";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  wtd: "Week",
  mtd: "Month",
  ytd: "Year",
  trends: "Trends",
};

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  end_of_day: "End of Day",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WWLD() {
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<Period>("today");
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [activeSessionType, setActiveSessionType] = useState<SessionType>("morning");
  const today = getTodayDate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const logParam = params.get("log") as SessionType | null;
    if (logParam && ["morning", "afternoon", "end_of_day"].includes(logParam)) {
      setActiveSessionType(logParam);
      setLogModalOpen(true);
      window.history.replaceState({}, "", "/wwld");
    }
  }, []);

  // ── Data queries ──
  const { data: todayData, isLoading: todayLoading } = trpc.wwld.getToday.useQuery({ date: today });
  const { data: todayStatus } = trpc.wwld.getTodayStatus.useQuery({ date: today });
  const analyticsQuery = trpc.wwld.getAnalytics.useQuery();

  // Always fetch all period ranges so data is ready instantly when switching tabs
  // and so invalidation after backlog saves refreshes everything regardless of active tab
  const wtdRange = getDateRange("wtd");
  const mtdRange = getDateRange("mtd");
  const ytdRange = getDateRange("ytd");

  const { data: wtdData, isLoading: wtdLoading } = trpc.wwld.getStats.useQuery(
    { startDate: wtdRange.start, endDate: wtdRange.end }
  );
  const { data: mtdData, isLoading: mtdLoading } = trpc.wwld.getStats.useQuery(
    { startDate: mtdRange.start, endDate: mtdRange.end }
  );
  const { data: ytdData, isLoading: ytdLoading } = trpc.wwld.getStats.useQuery(
    { startDate: ytdRange.start, endDate: ytdRange.end }
  );

  const periodData = period === "wtd" ? wtdData : period === "mtd" ? mtdData : period === "ytd" ? ytdData : undefined;
  const periodLoading = period === "wtd" ? wtdLoading : period === "mtd" ? mtdLoading : period === "ytd" ? ytdLoading : false;

  const totals = period === "today" ? todayData?.totals : periodData?.totals;
  const isLoading = period === "today" ? todayLoading : periodLoading;

  const weekRange = wtdRange;
  const weekData = wtdData;
  const filledWeekData = weekData?.dailyBreakdown ? fillWeekDays(weekData.dailyBreakdown, weekRange.start, weekRange.end) : [];

  // ── Analytics derived data ──
  const analytics = analyticsQuery.data as AnalyticsData | undefined;
  const insights = useMemo(() => (analytics ? generateInsights(analytics) : []), [analytics]);

  const weekCompData = useMemo(() => {
    if (!analytics) return [];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const byDayThis: Record<string, number> = {};
    const byDayLast: Record<string, number> = {};
    for (const d of analytics.thisWeek) { const k = formatShortDate(d.date); byDayThis[k] = (byDayThis[k] || 0) + d.officeVisits; }
    for (const d of analytics.lastWeek) { const k = formatShortDate(d.date); byDayLast[k] = (byDayLast[k] || 0) + d.officeVisits; }
    return days.map((day) => ({ day, "This Week": byDayThis[day] || 0, "Last Week": byDayLast[day] || 0 }));
  }, [analytics]);

  const trendData = useMemo(() => {
    if (!analytics) return [];
    return analytics.last30Days.map((d) => ({
      date: formatDate(d.date),
      "Office Visits": d.officeVisits,
      "New Patients": d.newPatients,
      "Care Plans": d.carePlansSigned,
    }));
  }, [analytics]);

  const openLogForm = (type: SessionType) => { setActiveSessionType(type); setLogModalOpen(true); };
  const existingSession = todayData?.sessions.find((s) => s.sessionType === activeSessionType);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-brand-gold/15 px-4 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-[var(--gold)]" />
            <div>
              <h1 className="text-xl font-bold text-foreground">WWLD</h1>
              <p className="text-xs text-muted-foreground">What Would Lyle Do?</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BacklogModal />
            <Button
              onClick={() => openLogForm(new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "end_of_day")}
              className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-bold"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Log Stats
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Period Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 items-center">
          {(["today", "wtd", "mtd", "ytd", "trends"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                p === "trends"
                  ? period === p
                    ? "bg-emerald-500 text-white shadow-md text-sm py-2.5"
                    : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 text-sm py-2.5"
                  : period === p
                    ? "bg-[var(--gold)] text-black shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "trends" ? "📈 Trends" : PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* ── TODAY / WTD / MTD / YTD ── */}
        {period !== "trends" && (
          <>
            {/* Stat Grid */}
            {isLoading ? (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Office Visits" alias="OV" value={totals?.officeVisits ?? 0} highlight={true} />
                <StatCard label="New Patients" alias="Day 1" value={totals?.newPatients ?? 0} />
                <StatCard label="Recall" alias="RC" value={(totals as any)?.recall ?? 0} />
                <StatCard label="Test Results" alias="Day 2" value={totals?.testResults ?? 0} />
                <StatCard label="Progress Exams" alias="PE" value={totals?.progressExams ?? 0} />
                <StatCard label="Performance Reviews" alias="PR" value={totals?.performanceReviews ?? 0} />
                <StatCard label="Care Plans Signed" alias="CPS" value={totals?.carePlansSigned ?? 0} highlight={true} />
              </div>
            )}

            {/* Lyle Algorithm Recommendation */}
            <LyleRecommendationCard />

            {/* Week chart + comparison */}
            {period === "wtd" && (
              <>
                {filledWeekData.length > 0 && (
                  <div className="bg-card border border-brand-gold/15 rounded-xl p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">Daily Breakdown — This Week</h3>
                    <WeekChart data={filledWeekData} metric="officeVisits" label="Office Visits" color="var(--gold)" />
                    <WeekChart data={filledWeekData} metric="newPatients" label="New Patients (Day 1)" color="var(--primary)" />
                    <WeekChart data={filledWeekData} metric="carePlansSigned" label="Care Plans Signed" color="var(--gold)" />
                  </div>
                )}
                {/* Week-over-week comparison chart */}
                {weekCompData.length > 0 && (
                  <div className="bg-card border border-brand-gold/15 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-4">This Week vs Last Week — Office Visits</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={weekCompData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.02 155)" />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "oklch(0.65 0.015 90)" }} />
                        <YAxis tick={{ fontSize: 11, fill: "oklch(0.65 0.015 90)" }} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="This Week" fill={GOLD} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Last Week" fill={GREEN2} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}

            {/* Month: day-of-week averages */}
            {period === "mtd" && analytics && analytics.dayOfWeekAverages.some((d) => d.dataPoints >= 4) && (
              <div className="bg-card border border-brand-gold/15 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-foreground mb-1">Average Office Visits by Day of Week</h3>
                <p className="text-xs text-muted-foreground mb-4">Based on separately logged daily stats from the last 30 days</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics.dayOfWeekAverages} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.02 155)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "oklch(0.65 0.015 90)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "oklch(0.65 0.015 90)" }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: number) => [val.toFixed(1), "Avg Visits"]} />
                    <Bar dataKey="avgOfficeVisits" name="Avg Office Visits" fill={GREEN} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Year: line chart */}
            {period === "ytd" && periodData && periodData.dailyBreakdown.length > 0 && (
              <div className="bg-card border border-brand-gold/15 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-foreground mb-4">Office Visits — Year to Date</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={periodData.dailyBreakdown.map((d) => ({ ...d, label: formatDate(d.date) }))} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.02 155)" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "oklch(0.65 0.015 90)" }} interval={Math.max(1, Math.floor(periodData.dailyBreakdown.length / 8))} />
                    <YAxis tick={{ fontSize: 11, fill: "oklch(0.65 0.015 90)" }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="officeVisits" name="Office Visits" stroke={GOLD} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="newPatients" name="New Patients" stroke={GREEN2} strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Today's Sessions Status */}
            <div className="bg-card border border-brand-gold/15 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Today's Sessions</h3>
              <div className="space-y-2">
                {(["morning", "afternoon", "end_of_day"] as SessionType[]).map((type) => {
                  const logged = type === "morning" ? todayStatus?.morning : type === "afternoon" ? todayStatus?.afternoon : todayStatus?.endOfDay;
                  return (
                    <div key={type} className="flex items-center justify-between py-2 border-b border-brand-gold/15 last:border-0">
                      <div className="flex items-center gap-2">
                        {logged ? <CheckCircle2 className="w-4 h-4 text-[var(--gold)]" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                        <span className={`text-sm ${logged ? "text-foreground font-medium" : "text-muted-foreground"}`}>{SESSION_TYPE_LABELS[type]}</span>
                      </div>
                      <button onClick={() => openLogForm(type)} className="text-xs text-[var(--gold)] hover:text-[var(--gold)]/80 font-semibold transition-colors">
                        {logged ? "Edit" : "Log"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Empty state */}
            {!isLoading && totals && Object.values(totals).every((v) => v === 0) && period !== "today" && (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No stats logged for this period yet.</p>
                <p className="text-xs mt-1">Start logging daily to see trends here.</p>
              </div>
            )}
          </>
        )}

        {/* ── TRENDS TAB ── */}
        {period === "trends" && (
          <div className="space-y-5">
            {/* Insight cards */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-[var(--gold)]" />
                Practice Insights
              </h3>
              {analyticsQuery.isLoading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
              ) : (
                <>
                  {analytics?.dataQuality.excludedBacklogSessions ? (
                    <p className="rounded-lg border border-brand-gold/15 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      Weekly and monthly backlog totals are excluded from daily trends and weekday insights.
                    </p>
                  ) : null}
                  {insights.map((insight, i) => <InsightCard key={i} insight={insight} />)}
                </>
              )}
            </div>

            {/* 30-day trend line */}
            {trendData.length >= 3 ? (
              <div className="bg-card border border-brand-gold/15 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-foreground mb-1">30-Day Trend</h3>
                <p className="text-xs text-muted-foreground mb-4">Office visits, new patients, and care plans</p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.02 155)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "oklch(0.65 0.015 90)" }} interval={Math.max(1, Math.floor(trendData.length / 8))} />
                    <YAxis tick={{ fontSize: 11, fill: "oklch(0.65 0.015 90)" }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="Office Visits" stroke={GOLD} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="New Patients" stroke={GREEN2} strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="Care Plans" stroke="oklch(0.65 0.2 25)" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              !analyticsQuery.isLoading && (
                <div className="rounded-lg border border-dashed border-brand-gold/15 p-8 text-center">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Log stats for at least 3 days to see trend charts.</p>
                </div>
              )
            )}

            {/* Schedule-aware day pattern */}
            {analytics && analytics.dayOfWeekAverages.some((d) => d.dataPoints >= 4) && (
              <div className="bg-card border border-brand-gold/15 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-foreground mb-1">Schedule-Aware Day Patterns</h3>
                <p className="text-xs text-muted-foreground mb-4">Full clinic days use full-day and weekday benchmarks. Half-days are compared only with the same weekday.</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics.dayOfWeekAverages} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.02 155)" />
                    <XAxis dataKey="day" tickFormatter={(day, index) => {
                      const item = analytics.dayOfWeekAverages[index];
                      return item?.scheduleType === "half" ? `${day} · ½` : day;
                    }} tick={{ fontSize: 11, fill: "oklch(0.65 0.015 90)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "oklch(0.65 0.015 90)" }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: number) => [val.toFixed(1)]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="avgOfficeVisits" name="Avg Office Visits" fill={GREEN} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="avgNewPatients" name="Avg New Patients" fill={GOLD} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Week-over-week comparison */}
            {weekCompData.some((d) => d["This Week"] > 0 || d["Last Week"] > 0) && (
              <div className="bg-card border border-brand-gold/15 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-foreground mb-4">This Week vs Last Week</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weekCompData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.02 155)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "oklch(0.65 0.015 90)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "oklch(0.65 0.015 90)" }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="This Week" fill={GOLD} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Last Week" fill={GREEN2} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log Stats Modal */}
      <Dialog open={logModalOpen} onOpenChange={setLogModalOpen}>
        <DialogContent className="bg-background border-brand-gold/15 max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {SESSION_TYPE_LABELS[activeSessionType]} — {today}
            </DialogTitle>
          </DialogHeader>
          <StatEntryForm
            sessionType={activeSessionType}
            sessionDate={today}
            initialValues={
              existingSession
                ? {
                    officeVisits: existingSession.officeVisits,
                    newPatients: existingSession.newPatients,
                    recall: (existingSession as any).recall ?? 0,
                    testResults: existingSession.testResults,
                    progressExams: existingSession.progressExams,
                    performanceReviews: existingSession.performanceReviews,
                    carePlansSigned: existingSession.carePlansSigned,
                  }
                : undefined
            }
            onSuccess={() => setLogModalOpen(false)}
            onCancel={() => setLogModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
