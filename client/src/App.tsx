import { useAuth } from "@/_core/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Curriculum from "./pages/Curriculum";
import ModuleDetail from "./pages/ModuleDetail";
import LessonView from "./pages/LessonView";
import Chat from "./pages/Chat";
import ContentStudio from "./pages/ContentStudio";
import Profile from "./pages/Profile";
import AdminModules from "./pages/AdminModules";
import AdminStats from "./pages/AdminStats";
import ModuleCoaching from "./pages/ModuleCoaching";
import Landing from "./pages/Landing";
import WWLD from "./pages/WWLD";
import TodaysGrowthPlan from "./pages/TodaysGrowthPlan";
import WeeklyReview from "./pages/WeeklyReview";
import CommunicationCoach from "./pages/CommunicationCoach";
import WwldCoach from "./pages/WwldCoach";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";
import ProfileCompletion from "./components/ProfileCompletion";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Daily action popup — shows on first visit of the day with two clear choices:
 * 1. Today's Plan (start of day)
 * 2. Log Stats (end of day)
 * Dismisses after choice or if user taps outside.
 */
function DailyActionPopup() {
  const [location, setLocation] = useLocation();
  const dismissed = useRef(false);
  const [visible, setVisible] = useState(true);
  const today = getTodayDate();
  const utils = trpc.useUtils();
  const { mutate: recordDailyCheckIn } = trpc.routine.recordDailyCheckIn.useMutation({
    onSuccess: () => {
      utils.routine.getStreak.invalidate();
    },
  });

  const { data: status } = trpc.wwld.getTodayStatus.useQuery(
    { date: today },
    { staleTime: 60_000, retry: false }
  );

  useEffect(() => {
    // Hide if already dismissed
    if (dismissed.current) {
      setVisible(false);
    }
  }, [status, location, setLocation]);

  useEffect(() => {
    // A streak represents an authenticated daily check-in. The server uses the
    // Central Time date and makes repeated visits on the same day idempotent.
    recordDailyCheckIn();
  }, [recordDailyCheckIn]);

  // Don't show if already dismissed
  if (!visible || dismissed.current) return null;

  const handleChoice = (path: string) => {
    dismissed.current = true;
    setVisible(false);
    setLocation(path);
  };

  const handleDismiss = () => {
    dismissed.current = true;
    setVisible(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleDismiss}
    >
      <div
        className="bg-card border border-brand-gold/30 rounded-2xl shadow-2xl shadow-brand-gold/10 max-w-sm w-full p-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Welcome back, Doc</h2>
          <p className="text-base text-muted-foreground">What are you here to do?</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleChoice("/today")}
            className="w-full py-4 px-6 rounded-xl bg-primary text-white text-lg font-bold hover:bg-primary/90 transition-colors shadow-lg flex items-center justify-center gap-3"
          >
            ✨ Today's Growth Plan
          </button>
          <button
            onClick={() => handleChoice("/wwld")}
            className="w-full py-4 px-6 rounded-xl bg-emerald-600 text-white text-lg font-bold hover:bg-emerald-700 transition-colors shadow-lg flex items-center justify-center gap-3"
          >
            📊 Log Stats
          </button>
        </div>

        <button
          onClick={handleDismiss}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip — go to dashboard
        </button>
      </div>
    </div>
  );
}

function AuthenticatedRouter() {
  return (
    <DashboardLayout>
      {/* Daily action popup — choose Today's Plan or Log Stats */}
      <ErrorBoundary>
        <DailyActionPopup />
      </ErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/curriculum" component={Curriculum} />
        <Route path="/curriculum/:moduleId" component={ModuleDetail} />
        <Route path="/curriculum/:moduleId/lesson/:lessonId" component={LessonView} />
        <Route path="/curriculum/:moduleId/coaching" component={ModuleCoaching} />
        <Route path="/chat" component={Chat} />
        <Route path="/content" component={ContentStudio} />
        <Route path="/profile" component={Profile} />
        <Route path="/admin/modules" component={AdminModules} />
        <Route path="/admin/stats" component={AdminStats} />
        <Route path="/wwld" component={WWLD} />
        <Route path="/today" component={TodaysGrowthPlan} />
        <Route path="/review" component={WeeklyReview} />
        <Route path="/communication" component={CommunicationCoach} />
        <Route path="/wwld-coach" component={WwldCoach} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return <Landing />;
  }

  // Require profile completion (name) before accessing the app
  const profileComplete = (user as any)?.profileComplete === true;
  const hasName = user?.name && user.name.trim() !== "";
  if (!hasName || !profileComplete) {
    return (
      <DashboardLayout>
        <Profile />
      </DashboardLayout>
    );
  }

  return (
    <ErrorBoundary>
      <AuthenticatedRouter />
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <AppRouter />
          <PWAInstallPrompt />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
