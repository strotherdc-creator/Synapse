import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { BookOpen } from "lucide-react";
import { useLocation } from "wouter";

export default function Curriculum() {
  const [, setLocation] = useLocation();
  const { data: modules, isLoading } = trpc.modules.list.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Curriculum
        </h1>
        <p className="text-muted-foreground mt-1">
          Browse all available modules and track your progress.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="bg-card border-border animate-pulse">
              <CardContent className="p-6">
                <div className="h-8 bg-muted rounded-lg w-8 mb-4" />
                <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                <div className="h-3 bg-muted rounded w-full mb-2" />
                <div className="h-2 bg-muted rounded w-full mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : modules && modules.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => {
            const modProgress =
              mod.lessonCount > 0
                ? Math.round((mod.completedCount / mod.lessonCount) * 100)
                : 0;
            return (
              <Card
                key={mod.id}
                className="bg-card border-border cursor-pointer hover:border-primary/50 transition-all group"
                onClick={() => setLocation(`/curriculum/${mod.id}`)}
              >
                <CardContent className="p-6">
                  <div className="text-3xl mb-3">{mod.iconEmoji || "📘"}</div>
                  <h3 className="font-semibold text-foreground text-lg group-hover:text-primary transition-colors">
                    {mod.title}
                  </h3>
                  {mod.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                      {mod.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-3">
                    <Progress value={modProgress} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {mod.completedCount}/{mod.lessonCount} lessons
                    </span>
                  </div>
                  {mod.status === "draft" && (
                    <span className="inline-block mt-3 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                      Draft
                    </span>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <BookOpen className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No modules yet
            </h3>
            <p className="text-muted-foreground">
              Curriculum content is being prepared. Check back soon!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
