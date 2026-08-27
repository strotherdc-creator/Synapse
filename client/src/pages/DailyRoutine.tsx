import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Flame, Trophy, Target, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DAILY_TASKS = [
  {
    key: "curriculum",
    label: "Complete a curriculum lesson",
    description: "Work through at least one lesson in Bridge the Gap",
  },
  {
    key: "content",
    label: "Generate one piece of content",
    description: "Use Content Studio to create a post, email, or script",
  },
  {
    key: "review",
    label: "Review your positioning statement",
    description: "Read through and refine your unique positioning",
  },
  {
    key: "outreach",
    label: "One outreach action",
    description: "Send a referral request, post on social, or email a prospect",
  },
  {
    key: "learn",
    label: "Ask the AI Coach a question",
    description: "Deepen your understanding of a concept or get coaching",
  },
];

function getTodayStr() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export default function DailyRoutine() {
  const today = getTodayStr();
  const utils = trpc.useUtils();

  const tasksQuery = trpc.routine.getTasks.useQuery({ date: today });
  const streakQuery = trpc.routine.getStreak.useQuery();

  const toggleMutation = trpc.routine.toggleTask.useMutation({
    onSuccess: () => {
      utils.routine.getTasks.invalidate({ date: today });
      utils.routine.getStreak.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const completedTasks = useMemo(() => {
    const map = new Map<string, boolean>();
    tasksQuery.data?.forEach((t) => map.set(t.taskKey, t.completed));
    return map;
  }, [tasksQuery.data]);

  const completedCount = DAILY_TASKS.filter(
    (t) => completedTasks.get(t.key) === true
  ).length;
  const totalTasks = DAILY_TASKS.length;
  const progressPercent = Math.round((completedCount / totalTasks) * 100);

  const handleToggle = (taskKey: string, currentlyCompleted: boolean) => {
    toggleMutation.mutate({
      date: today,
      taskKey,
      completed: !currentlyCompleted,
    });
  };

  const streak = streakQuery.data;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Daily Routine</h1>
        <p className="text-muted-foreground mt-1">
          Build consistent habits to grow your practice every day.
        </p>
      </div>

      {/* Streak & Progress Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <Flame className="h-6 w-6 text-orange-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{streak?.currentStreak ?? 0}</p>
            <p className="text-xs text-muted-foreground">Check-in Streak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <Trophy className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{streak?.longestStreak ?? 0}</p>
            <p className="text-xs text-muted-foreground">Best Streak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <Target className="h-6 w-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {completedCount}/{totalTasks}
            </p>
            <p className="text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <CheckCircle2
              className={`h-6 w-6 mx-auto mb-1 ${progressPercent === 100 ? "text-green-500" : "text-muted-foreground"}`}
            />
            <p className="text-2xl font-bold">{progressPercent}%</p>
            <p className="text-xs text-muted-foreground">Complete</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Today's Tasks
          </CardTitle>
          <CardDescription>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasksQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-1">
              {DAILY_TASKS.map((task) => {
                const isCompleted = completedTasks.get(task.key) === true;
                return (
                  <button
                    key={task.key}
                    onClick={() => handleToggle(task.key, isCompleted)}
                    disabled={toggleMutation.isPending}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left ${
                      isCompleted
                        ? "bg-primary/5 border border-primary/20"
                        : "hover:bg-accent border border-transparent"
                    }`}
                  >
                    <Checkbox
                      checked={isCompleted}
                      className="mt-0.5 pointer-events-none"
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          isCompleted
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {task.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {task.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {progressPercent === 100 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-6 text-center">
            <Trophy className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground">
              All tasks complete!
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Great work today. Your streak is now{" "}
              <span className="font-bold text-primary">
                {streak?.currentStreak ?? 0}
              </span>{" "}
              days!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
