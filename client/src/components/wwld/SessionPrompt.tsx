import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { BarChart2, X } from "lucide-react";

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getCurrentSessionType(): "morning" | "afternoon" | "end_of_day" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "end_of_day";
}

function getSessionLabel(type: "morning" | "afternoon" | "end_of_day"): string {
  return {
    morning: "morning",
    afternoon: "afternoon",
    end_of_day: "end-of-day",
  }[type];
}

function getDismissKey(date: string, type: string): string {
  return `wwld_dismissed_${date}_${type}`;
}

export function SessionPrompt() {
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const today = getTodayDate();
  const sessionType = getCurrentSessionType();
  const dismissKey = getDismissKey(today, sessionType);

  // Check if already dismissed this session
  const [alreadyDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(dismissKey) === "1";
    } catch {
      return false;
    }
  });

  const { data: status, isLoading } = trpc.wwld.getTodayStatus.useQuery(
    { date: today },
    {
      staleTime: 60_000,
      enabled: !alreadyDismissed && !dismissed,
    }
  );

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(dismissKey, "1");
    } catch {}
    setDismissed(true);
  };

  const handleLogNow = () => {
    handleDismiss();
    setLocation(`/wwld?log=${sessionType}&date=${today}`);
  };

  // Don't show if loading, dismissed, or already logged this session type
  if (isLoading || dismissed || alreadyDismissed) return null;
  if (!status) return null;

  const alreadyLogged =
    (sessionType === "morning" && status.morning) ||
    (sessionType === "afternoon" && status.afternoon) ||
    (sessionType === "end_of_day" && status.endOfDay);

  if (alreadyLogged) return null;

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-4 mb-4 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-4 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
      <BarChart2 className="w-5 h-5 text-[var(--gold)] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {greeting}! Log your {getSessionLabel(sessionType)} stats?
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          What Would Lyle Do? Track your numbers.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleLogNow}
          className="text-xs font-bold text-[var(--gold)] hover:text-[var(--gold)]/80 transition-colors px-2 py-1 rounded-md hover:bg-[var(--gold)]/10"
        >
          Log Now
        </button>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
