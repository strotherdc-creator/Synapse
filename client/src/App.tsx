import { useAuth } from "@/_core/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
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
import Landing from "./pages/Landing";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";
import { AuthDebugPanel } from "./components/AuthDebugPanel";

function AuthenticatedRouter() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/curriculum" component={Curriculum} />
        <Route path="/curriculum/:moduleId" component={ModuleDetail} />
        <Route path="/curriculum/:moduleId/lesson/:lessonId" component={LessonView} />
        <Route path="/chat" component={Chat} />
        <Route path="/content" component={ContentStudio} />
        <Route path="/routine" component={DailyRoutine} />
        <Route path="/profile" component={Profile} />
        <Route path="/admin/modules" component={AdminModules} />
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

  return <AuthenticatedRouter />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <AppRouter />
          <AuthDebugPanel />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
