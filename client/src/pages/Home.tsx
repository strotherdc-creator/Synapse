import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { BookOpen, CheckCircle2, MessageSquare, Zap, Trophy, Target, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { SessionPrompt } from "@/components/wwld/SessionPrompt";
import { moduleCardStates } from "@shared/curriculumProgress";
import { ContinueCurriculumButton } from "@/components/curriculum/ContinueCurriculumButton";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: modulesRaw, isLoading } = trpc.modules.list.useQuery();
  // Defense-in-depth: learner Home only counts/renders published modules
  const modules = modulesRaw?.filter((m) => m.status === "published");

  // Coaching step progress (primary metric)
  const totalSteps = modules?.reduce((sum, m) => sum + m.stepCount, 0) ?? 0;
  const completedSteps = modules?.reduce((sum, m) => sum + m.completedStepCount, 0) ?? 0;
  const stepProgressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Module completion count
  const completedModules = modules?.filter((m) => m.moduleComplete).length ?? 0;
  const totalModules = modules?.length ?? 0;

  return (
    <div className="readable space-y-8">
      {/* WWLD daily stats prompt */}
      <SessionPrompt />

      {/* Daily front door — Today's Plan */}
      <button
        type="button"
        onClick={() => setLocation("/today")}
        className="w-full text-left rounded-2xl border-2 border-emerald-500/40 bg-emerald-950/20 hover:border-emerald-500/70 p-5 transition-colors"
      >
        <p className="text-sm font-bold text-emerald-200 uppercase tracking-wide">Daily start</p>
        <p className="text-xl font-bold text-foreground mt-1">Start Today's Plan</p>
        <p className="text-sm text-muted-foreground mt-1">
          One next action and WWLD stats — without menu hunting.
        </p>
      </button>

      {/* Straight to the next curriculum step */}
      <ContinueCurriculumButton />

      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back{user?.name ? `, ${user.name}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          Continue your learning journey with Synapse.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-brand-gold/15">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall Progress
            </CardTitle>
            <Zap className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gold">{stepProgressPercent}%</div>
            <Progress value={stepProgressPercent} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {completedSteps} of {totalSteps} steps completed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-brand-gold/15">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Modules Completed
            </CardTitle>
            <Trophy className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {completedModules} / {totalModules}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {completedModules === totalModules && totalModules > 0
                ? "All modules complete!"
                : completedModules > 0
                  ? "Keep going!"
                  : "Start your first module"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-brand-gold/15">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Steps Completed
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {completedSteps} / {totalSteps}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Coaching steps across all modules</p>
          </CardContent>
        </Card>

        <Card
          className="bg-card border-brand-gold/15 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setLocation("/chat")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              AI Assistant
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium text-foreground">Ask Synapse</div>
            <p className="text-xs text-muted-foreground mt-1">
              Get help with any lesson
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Module list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Your Modules</h2>
          <button
            type="button"
            onClick={() => setLocation("/curriculum")}
            className="min-h-[44px] px-2 text-base font-semibold text-gold hover:underline"
          >
            View all
          </button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-card border-brand-gold/15 animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                  <div className="h-3 bg-muted rounded w-full mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : modules && modules.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {moduleCardStates(modules).map((mod) => {
              const { card } = mod;
              const body = (
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl" aria-hidden="true">{mod.iconEmoji || "📘"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-muted-foreground">Module {card.moduleNumber}</p>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-foreground">{mod.title}</h3>
                        {!card.unlocked ? (
                          <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                        ) : card.complete ? (
                          <CheckCircle2 className="h-5 w-5 text-gold flex-shrink-0" aria-hidden="true" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {card.unlocked && card.total > 0 && (
                    <Progress value={card.percent} className="h-2.5" aria-hidden="true" />
                  )}
                  <p className={`mt-2 text-lg font-semibold ${!card.unlocked ? "text-muted-foreground" : card.complete ? "text-gold" : "text-foreground"}`}>
                    {!card.unlocked && <span className="sr-only">Locked. </span>}
                    {card.label}
                  </p>
                </CardContent>
              );
              return card.unlocked ? (
                <button
                  type="button"
                  key={mod.id}
                  onClick={() => setLocation(`/curriculum/${mod.id}`)}
                  className="block w-full text-left rounded-xl"
                >
                  <Card className="bg-card border-brand-gold/30 hover:border-primary transition-colors">{body}</Card>
                </button>
              ) : (
                <Card key={mod.id} className="bg-card/60 border-2 border-dashed border-gray-400/70" aria-disabled="true">
                  {body}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-card border-brand-gold/15">
            <CardContent className="p-8 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                No modules available yet. Check back soon!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
