import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BookOpen, CheckCircle2, Circle } from "lucide-react";
import { useLocation, useParams } from "wouter";

export default function ModuleDetail() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = parseInt(params.moduleId || "0");
  const [, setLocation] = useLocation();

  const { data: mod, isLoading: modLoading } = trpc.modules.getById.useQuery({ id: moduleId });
  const { data: lessons, isLoading: lessonsLoading } = trpc.lessons.list.useQuery({ moduleId });

  const completedCount = lessons?.filter((l) => l.completed).length ?? 0;
  const totalCount = lessons?.length ?? 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const isLoading = modLoading || lessonsLoading;

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocation("/curriculum")}
        className="text-muted-foreground hover:text-foreground -ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Curriculum
      </Button>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-2 bg-muted rounded w-full mt-4" />
        </div>
      ) : mod ? (
        <>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{mod.iconEmoji || "📘"}</span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {mod.title}
              </h1>
            </div>
            {mod.description && (
              <p className="text-muted-foreground">{mod.description}</p>
            )}
            <div className="flex items-center gap-3 mt-4">
              <Progress value={progressPercent} className="h-2 flex-1 max-w-xs" />
              <span className="text-sm text-muted-foreground">
                {completedCount}/{totalCount} completed
              </span>
            </div>
          </div>

          {lessons && lessons.length > 0 ? (
            <div className="space-y-2">
              {lessons.map((lesson, index) => (
                <Card
                  key={lesson.id}
                  className="bg-card border-border cursor-pointer hover:border-primary/50 transition-colors group"
                  onClick={() =>
                    setLocation(`/curriculum/${moduleId}/lesson/${lesson.id}`)
                  }
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="shrink-0">
                      {lesson.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {lesson.title}
                        </h3>
                      </div>
                      {lesson.summary && (
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">
                          {lesson.summary}
                        </p>
                      )}
                    </div>
                    {lesson.status === "draft" && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded shrink-0">
                        Draft
                      </span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No lessons in this module yet.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Module not found.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
