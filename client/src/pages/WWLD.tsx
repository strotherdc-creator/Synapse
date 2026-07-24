import { useState, useEffect } from "react";
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
import { StatEntryForm } from "@/components/wwld/StatEntryForm";
import { Plus, CheckCircle2, Circle, BarChart2 } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateRange(
  period: "today" | "wtd" | "mtd" | "ytd"
): { start: string; end: string } {
  const today = new Date();
  const end = getTodayDate();

  if (period === "today") {
    return { start: end, end };
  }

  if (period === "wtd") {
    // Monday of current week
    const day = today.getDay(); // 0=Sun, 1=Mon...
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

  // ytd
  const start = `${today.getFullYear()}-01-01`;
  return { start, end };
}

function fillWeekDays(
  data: Array<{ date: string; [key: string]: number | string }>,
  start: string,
  end: string
) {
  const result = [];
  const startD = new Date(start + "T00:00:00");
  const endD = new Date(end + "T00:00:00");
  const byDate: Record<string, (typeof data)[0]> = {};
  for (const d of data) byDate[d.date] = d;

  const cur = new Date(startD);
  while (cur <= endD) {
    const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    result.push(
      byDate[dateStr] ?? {
        date: dateStr,
        officeVisits: 0,
        newPatients: 0,
        testResults: 0,
        progressExams: 0,
        performanceReviews: 0,
        carePlansSigned: 0,
      }
    );
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

type Period = "today" | "wtd" | "mtd" | "ytd";
type SessionType = "morning" | "afternoon" | "end_of_day";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  wtd: "This Week",
  mtd: "This Month",
  ytd: "This Year",
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

  // Parse URL params for auto-opening log form
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const logParam = params.get("log") as SessionType | null;
    if (logParam && ["morning", "afternoon", "end_of_day"].includes(logParam)) {
      setActiveSessionType(logParam);
      setLogModalOpen(true);
      // Clean URL
      window.history.replaceState({}, "", "/wwld");
    }
  }, []);

  // Today's data
  const { data: todayData, isLoading: todayLoading } = trpc.wwld.getToday.useQuery({
    date: today,
  });

  // Today's status (which sessions logged)
  const { data: todayStatus } = trpc.wwld.getTodayStatus.useQuery({ date: today });

  // Period stats
  const { start, end } = getDateRange(period === "today" ? "today" : period);
  const { data: periodData, isLoading: periodLoading } = trpc.wwld.getStats.useQuery(
    { startDate: start, endDate: end },
    { enabled: period !== "today" }
  );

  // Determine which totals to show
  const totals =
    period === "today"
      ? todayData?.totals
      : periodData?.totals;

  const isLoading = period === "today" ? todayLoading : periodLoading;

  // Week chart data (only shown on WTD view)
  const weekRange = getDateRange("wtd");
  const { data: weekData } = trpc.wwld.getStats.useQuery(
    { startDate: weekRange.start, endDate: weekRange.end },
    { enabled: period === "wtd" }
  );
  const filledWeekData =
    weekData?.dailyBreakdown
      ? fillWeekDays(weekData.dailyBreakdown, weekRange.start, weekRange.end)
      : [];

  const openLogForm = (type: SessionType) => {
    setActiveSessionType(type);
    setLogModalOpen(true);
  };

  // Get existing values for the active session type (for edit mode)
  const existingSession = todayData?.sessions.find(
    (s) => s.sessionType === activeSessionType
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-[var(--gold)]" />
            <div>
              <h1 className="text-xl font-bold text-foreground">WWLD</h1>
              <p className="text-xs text-muted-foreground">What Would Lyle Do?</p>
            </div>
          </div>
          <Button
            onClick={() => openLogForm(
              new Date().getHours() < 12
                ? "morning"
                : new Date().getHours() < 17
                ? "afternoon"
                : "end_of_day"
            )}
            className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-bold"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Log Stats
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Period Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {(["today", "wtd", "mtd", "ytd"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                period === p
                  ? "bg-[var(--gold)] text-black shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Stat Grid */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Office Visits"
              alias="OV"
              value={totals?.officeVisits ?? 0}
              highlight={true}
            />
            <StatCard
              label="New Patients"
              alias="Day 1"
              value={totals?.newPatients ?? 0}
            />
            <StatCard
              label="Test Results"
              alias="Day 2"
              value={totals?.testResults ?? 0}
            />
            <StatCard
              label="Progress Exams"
              alias="PE"
              value={totals?.progressExams ?? 0}
            />
            <StatCard
              label="Performance Reviews"
              alias="PR"
              value={totals?.performanceReviews ?? 0}
            />
            <StatCard
              label="Care Plans Signed"
              alias="CPS"
              value={totals?.carePlansSigned ?? 0}
              highlight={true}
            />
          </div>
        )}

        {/* Week Chart (WTD only) */}
        {period === "wtd" && filledWeekData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Daily Breakdown — This Week
            </h3>
            <WeekChart
              data={filledWeekData}
              metric="officeVisits"
              label="Office Visits"
              color="var(--gold)"
            />
            <WeekChart
              data={filledWeekData}
              metric="newPatients"
              label="New Patients (Day 1)"
              color="var(--primary)"
            />
            <WeekChart
              data={filledWeekData}
              metric="carePlansSigned"
              label="Care Plans Signed"
              color="var(--gold)"
            />
          </div>
        )}

        {/* Today's Sessions Status */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Today's Sessions
          </h3>
          <div className="space-y-2">
            {(["morning", "afternoon", "end_of_day"] as SessionType[]).map((type) => {
              const logged =
                type === "morning"
                  ? todayStatus?.morning
                  : type === "afternoon"
                  ? todayStatus?.afternoon
                  : todayStatus?.endOfDay;
              return (
                <div
                  key={type}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {logged ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--gold)]" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span
                      className={`text-sm ${
                        logged ? "text-foreground font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {SESSION_TYPE_LABELS[type]}
                    </span>
                  </div>
                  <button
                    onClick={() => openLogForm(type)}
                    className="text-xs text-[var(--gold)] hover:text-[var(--gold)]/80 font-semibold transition-colors"
                  >
                    {logged ? "Edit" : "Log"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Empty state for periods with no data */}
        {!isLoading &&
          totals &&
          Object.values(totals).every((v) => v === 0) &&
          period !== "today" && (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No stats logged for this period yet.</p>
              <p className="text-xs mt-1">Start logging daily to see trends here.</p>
            </div>
          )}
      </div>

      {/* Log Stats Modal */}
      <Dialog open={logModalOpen} onOpenChange={setLogModalOpen}>
        <DialogContent className="bg-background border-border max-w-md mx-auto">
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
