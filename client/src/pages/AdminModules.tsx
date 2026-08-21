import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Edit,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ModuleForm = {
  title: string;
  description: string;
  sortOrder: number;
  status: "draft" | "published";
  iconEmoji: string;
};

type LessonForm = {
  title: string;
  content: string;
  summary: string;
  sortOrder: number;
  status: "draft" | "published";
};

const defaultModuleForm: ModuleForm = {
  title: "",
  description: "",
  sortOrder: 0,
  status: "draft",
  iconEmoji: "📘",
};

const defaultLessonForm: LessonForm = {
  title: "",
  content: "",
  summary: "",
  sortOrder: 0,
  status: "draft",
};

export default function AdminModules() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: modules, isLoading } = trpc.modules.list.useQuery();

  // Module dialog state
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [moduleForm, setModuleForm] = useState<ModuleForm>(defaultModuleForm);

  // Lesson dialog state
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [lessonModuleId, setLessonModuleId] = useState<number>(0);
  const [lessonForm, setLessonForm] = useState<LessonForm>(defaultLessonForm);

  // Expanded modules
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());

  // Mutations
  const createModule = trpc.modules.create.useMutation({
    onSuccess: () => {
      toast.success("Module created");
      utils.modules.list.invalidate();
      setModuleDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateModule = trpc.modules.update.useMutation({
    onSuccess: () => {
      toast.success("Module updated");
      utils.modules.list.invalidate();
      setModuleDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteModule = trpc.modules.delete.useMutation({
    onSuccess: () => {
      toast.success("Module deleted");
      utils.modules.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createLesson = trpc.lessons.create.useMutation({
    onSuccess: () => {
      toast.success("Lesson created");
      utils.lessons.list.invalidate();
      setLessonDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateLesson = trpc.lessons.update.useMutation({
    onSuccess: () => {
      toast.success("Lesson updated");
      utils.lessons.list.invalidate();
      setLessonDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteLesson = trpc.lessons.delete.useMutation({
    onSuccess: () => {
      toast.success("Lesson deleted");
      utils.lessons.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">
          You do not have permission to access this page.
        </p>
      </div>
    );
  }

  const openNewModule = () => {
    setEditingModuleId(null);
    setModuleForm(defaultModuleForm);
    setModuleDialogOpen(true);
  };

  const openEditModule = (mod: any) => {
    setEditingModuleId(mod.id);
    setModuleForm({
      title: mod.title,
      description: mod.description || "",
      sortOrder: mod.sortOrder,
      status: mod.status,
      iconEmoji: mod.iconEmoji || "📘",
    });
    setModuleDialogOpen(true);
  };

  const handleSaveModule = () => {
    if (editingModuleId) {
      updateModule.mutate({ id: editingModuleId, ...moduleForm });
    } else {
      createModule.mutate(moduleForm);
    }
  };

  const openNewLesson = (moduleId: number) => {
    setEditingLessonId(null);
    setLessonModuleId(moduleId);
    setLessonForm(defaultLessonForm);
    setLessonDialogOpen(true);
  };

  const openEditLesson = (lesson: any, moduleId: number) => {
    setEditingLessonId(lesson.id);
    setLessonModuleId(moduleId);
    setLessonForm({
      title: lesson.title,
      content: lesson.content || "",
      summary: lesson.summary || "",
      sortOrder: lesson.sortOrder,
      status: lesson.status,
    });
    setLessonDialogOpen(true);
  };

  const handleSaveLesson = () => {
    if (editingLessonId) {
      updateLesson.mutate({ id: editingLessonId, ...lessonForm });
    } else {
      createLesson.mutate({ moduleId: lessonModuleId, ...lessonForm });
    }
  };

  const toggleExpand = (moduleId: number) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Manage Modules
          </h1>
          <p className="text-muted-foreground mt-1">
            Add, edit, and organize curriculum content.
          </p>
        </div>
        <Button onClick={openNewModule}>
          <Plus className="h-4 w-4 mr-2" />
          New Module
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card border-brand-gold/15 animate-pulse">
              <CardContent className="p-4">
                <div className="h-5 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : modules && modules.length > 0 ? (
        <div className="space-y-3">
          {modules.map((mod) => (
            <ModuleRow
              key={mod.id}
              mod={mod}
              expanded={expandedModules.has(mod.id)}
              onToggle={() => toggleExpand(mod.id)}
              onEdit={() => openEditModule(mod)}
              onDelete={() => {
                if (confirm("Delete this module and all its lessons?")) {
                  deleteModule.mutate({ id: mod.id });
                }
              }}
              onAddLesson={() => openNewLesson(mod.id)}
              onEditLesson={(lesson: any) => openEditLesson(lesson, mod.id)}
              onDeleteLesson={(lessonId: number) => {
                if (confirm("Delete this lesson?")) {
                  deleteLesson.mutate({ id: lessonId });
                }
              }}
            />
          ))}
        </div>
      ) : (
        <Card className="bg-card border-brand-gold/15">
          <CardContent className="p-8 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">
              No modules yet. Create your first module to get started.
            </p>
            <Button onClick={openNewModule}>
              <Plus className="h-4 w-4 mr-2" />
              Create Module
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Module Dialog */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>
              {editingModuleId ? "Edit Module" : "New Module"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Input
                  value={moduleForm.iconEmoji}
                  onChange={(e) =>
                    setModuleForm({ ...moduleForm, iconEmoji: e.target.value })
                  }
                  maxLength={16}
                  className="text-center text-xl"
                />
              </div>
              <div className="col-span-3 space-y-2">
                <Label>Title</Label>
                <Input
                  value={moduleForm.title}
                  onChange={(e) =>
                    setModuleForm({ ...moduleForm, title: e.target.value })
                  }
                  placeholder="Module title"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={moduleForm.description}
                onChange={(e) =>
                  setModuleForm({ ...moduleForm, description: e.target.value })
                }
                placeholder="Brief description of this module"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={moduleForm.sortOrder}
                  onChange={(e) =>
                    setModuleForm({
                      ...moduleForm,
                      sortOrder: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={moduleForm.status}
                  onValueChange={(v) =>
                    setModuleForm({
                      ...moduleForm,
                      status: v as "draft" | "published",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModuleDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveModule}
              disabled={
                !moduleForm.title ||
                createModule.isPending ||
                updateModule.isPending
              }
            >
              {editingModuleId ? "Save Changes" : "Create Module"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="bg-card text-card-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingLessonId ? "Edit Lesson" : "New Lesson"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={lessonForm.title}
                onChange={(e) =>
                  setLessonForm({ ...lessonForm, title: e.target.value })
                }
                placeholder="Lesson title"
              />
            </div>
            <div className="space-y-2">
              <Label>Summary (used as AI context)</Label>
              <Textarea
                value={lessonForm.summary}
                onChange={(e) =>
                  setLessonForm({ ...lessonForm, summary: e.target.value })
                }
                placeholder="Brief summary for AI assistant context"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                value={lessonForm.content}
                onChange={(e) =>
                  setLessonForm({ ...lessonForm, content: e.target.value })
                }
                placeholder="Full lesson content (supports plain text)"
                rows={10}
                className="font-mono text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={lessonForm.sortOrder}
                  onChange={(e) =>
                    setLessonForm({
                      ...lessonForm,
                      sortOrder: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={lessonForm.status}
                  onValueChange={(v) =>
                    setLessonForm({
                      ...lessonForm,
                      status: v as "draft" | "published",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLessonDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveLesson}
              disabled={
                !lessonForm.title ||
                createLesson.isPending ||
                updateLesson.isPending
              }
            >
              {editingLessonId ? "Save Changes" : "Create Lesson"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Module Row with expandable lessons ──────────────────────────────

function ModuleRow({
  mod,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
}: {
  mod: any;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddLesson: () => void;
  onEditLesson: (lesson: any) => void;
  onDeleteLesson: (lessonId: number) => void;
}) {
  const { data: lessons } = trpc.lessons.list.useQuery(
    { moduleId: mod.id },
    { enabled: expanded }
  );

  return (
    <Card className="bg-card border-brand-gold/15">
      <CardContent className="p-0">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={onToggle}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <span className="text-xl">{mod.iconEmoji || "📘"}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-foreground truncate">
                {mod.title}
              </h3>
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  mod.status === "published"
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {mod.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {mod.lessonCount} lessons · Order: {mod.sortOrder}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8">
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-brand-gold/15 px-4 pb-4 pt-2">
            {lessons && lessons.length > 0 ? (
              <div className="space-y-1">
                {lessons.map((lesson, idx) => (
                  <div
                    key={lesson.id}
                    className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-accent/50 group"
                  >
                    <span className="text-xs text-muted-foreground font-mono w-6">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground truncate block">
                        {lesson.title}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        lesson.status === "published"
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {lesson.status}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEditLesson(lesson)}
                        className="h-7 w-7"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteLesson(lesson.id)}
                        className="h-7 w-7 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                No lessons yet.
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onAddLesson}
              className="mt-3"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Lesson
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
