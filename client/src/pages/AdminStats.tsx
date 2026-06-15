import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Users,
  Activity,
  CheckCircle2,
  TrendingUp,
  Flame,
  FileText,
  BarChart3,
} from "lucide-react";

export default function AdminStats() {
  const { user } = useAuth();
  const { data: stats, isLoading } = trpc.adminStats.getStats.useQuery();

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">User Analytics</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-8 bg-muted rounded w-16 mb-2" />
                <div className="h-4 bg-muted rounded w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Unable to load stats. Database may be unavailable.</p>
      </div>
    );
  }

  const avgProgress =
    stats.totalUsers > 0 && stats.totalStepsAvailable > 0
      ? Math.round(
          (stats.totalStepsCompleted / (stats.totalUsers * stats.totalStepsAvailable)) * 100
        )
      : 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">User Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Real-time engagement and progress data across all users.
        </p>
      </div>

      {/* Top-level metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gold/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeUsers7d}</p>
                <p className="text-sm text-muted-foreground">Active (7 days)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeUsers30d}</p>
                <p className="text-sm text-muted-foreground">Active (30 days)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gold/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalStepsCompleted}</p>
                <p className="text-sm text-muted-foreground">Steps Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Flame className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-lg font-semibold">{stats.recentStepsCompleted}</p>
                <p className="text-sm text-muted-foreground">Steps completed (last 7 days)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-lg font-semibold">{stats.totalContentGenerated}</p>
                <p className="text-sm text-muted-foreground">Content pieces generated</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-lg font-semibold">{avgProgress}%</p>
                <p className="text-sm text-muted-foreground">Avg. curriculum progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Module Completion Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Module Completion Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead className="text-center">Steps</TableHead>
                <TableHead className="text-center">Users Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.moduleBreakdown.map((mod) => (
                <TableRow key={mod.moduleId}>
                  <TableCell className="font-medium">
                    <span className="mr-2">{mod.iconEmoji}</span>
                    {mod.title}
                  </TableCell>
                  <TableCell className="text-center">{mod.stepCount}</TableCell>
                  <TableCell className="text-center">
                    <span className={mod.usersCompleted > 0 ? "text-gold font-semibold" : "text-muted-foreground"}>
                      {mod.usersCompleted}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Steps Done</TableHead>
                  <TableHead className="text-center">Streak</TableHead>
                  <TableHead className="text-center">Best Streak</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.userActivity.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.name}
                      {u.role === "admin" && (
                        <span className="ml-2 text-xs bg-gold/20 text-gold px-1.5 py-0.5 rounded">
                          admin
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.email}
                    </TableCell>
                    <TableCell className="text-center">
                      {u.stepsCompleted}/{stats.totalStepsAvailable}
                    </TableCell>
                    <TableCell className="text-center">
                      {u.currentStreak > 0 ? (
                        <span className="text-orange-500 font-medium">
                          {u.currentStreak}d
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {u.longestStreak > 0 ? u.longestStreak : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelativeDate(u.lastSignedIn)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatRelativeDate(date: string | Date | null): string {
  if (!date) return "Never";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(date);
}

function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
