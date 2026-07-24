import { useAuth } from "@/_core/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect, useRef } from "react";
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
import DailyRoutine from "./pages/DailyRoutine";
import Profile from "./pages/Profile";
import AdminModules from "./pages/AdminModules";
import AdminStats from "./pages/AdminStats";
import ModuleCoaching from "./pages/ModuleCoaching";
import Landing from "./pages/Landing";
import WWLD from "./pages/WWLD";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";
import ProfileCompletion from "./components/ProfileCompletion";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Silently redirects to /wwld on first login of the day if no stats have been logged.
 * Renders nothing — purely a side-effect component mounted inside the authenticated router.
 */
function WwldLoginRedirect() {
  const [location, setLocation] = useLocation();
  const redirected = useRef(false);
  const today = getTodayDate();

  const { data: status } = trpc.wwld.getTodayStatus.useQuery(
    { date: today },
    { staleTime: 60_000, retry: false }
  );

  useEffect(() => {
    if (redirected.current) return;
    if (!status) return;
    // Only redirect if user landed on root "/" and hasn't logged any session today
    const nothingLogged = !status.morning && !status.afternoon && !status.endOfDay;
    if (nothingLogged && location === "/") {
      redirected.current = true;
      setLocation("/wwld");
    }
  }, [status, location, setLocation]);

  return null;
}

function AuthenticatedRouter() {
  return (
    <DashboardLayout>
      {/* WWLD-first: redirect to /wwld on login if no stats logged today */}
      <WwldLoginRedirect />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/curriculum" component={Curriculum} />
        <Route path="/curriculum/:moduleId" component={ModuleDetail} />
        <Route path="/curriculum/:moduleId/lesson/:lessonId" component={LessonView} />
        <Route path="/curriculum/:moduleId/coaching" component={ModuleCoaching} />
        <Route path="/chat" component={Chat} />
        <Route path="/content" component={ContentStudio} />
        <Route path="/routine" component={DailyRoutine} />
        <Route path="/profile" component={Profile} />
        <Route path="/admin/modules" component={AdminModules} />
        <Route path="/admin/stats" component={AdminStats} />
        <Route path="/wwld" component={WWLD} />
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
  if (!user.name || user.name.trim() === "") {
    return <ProfileCompletion />;
  }

  return <AuthenticatedRouter />;
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
