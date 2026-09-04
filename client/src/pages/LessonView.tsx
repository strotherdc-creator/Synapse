import { AIChatBox, Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import ReactMarkdown from "react-markdown";

export default function LessonView() {
  const params = useParams<{ moduleId: string; lessonId: string }>();
  const moduleId = parseInt(params.moduleId || "0");
  const lessonId = parseInt(params.lessonId || "0");
  const [, setLocation] = useLocation();

  const { data: lesson, isLoading } = trpc.lessons.getById.useQuery({ id: lessonId });
  const { data: chatHistory } = trpc.ai.history.useQuery({ lessonId });
  const { data: progressData } = trpc.progress.getByModule.useQuery({ moduleId });

  const isCompleted = progressData?.some(
    (p) => p.lessonId === lessonId && p.completed
  );

  const utils = trpc.useUtils();

  const toggleMutation = trpc.progress.toggle.useMutation({
    onSuccess: () => {
      utils.progress.getByModule.invalidate({ moduleId });
      utils.progress.getAll.invalidate();
      utils.modules.list.invalidate();
      utils.lessons.list.invalidate({ moduleId });
    },
  });

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInitialized, setChatInitialized] = useState(false);

  // Stable lesson ID for memo
  const stableLessonId = useMemo(() => lessonId, [lessonId]);

  useEffect(() => {
    if (chatHistory && !chatInitialized) {
      const historyMessages: Message[] = chatHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));
      setMessages(historyMessages);
      setChatInitialized(true);
    }
  }, [chatHistory, chatInitialized]);

  // Reset chat when lesson changes
  useEffect(() => {
    setChatInitialized(false);
    setMessages([]);
  }, [stableLessonId]);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.content },
      ]);
    },
  });

  const handleSendMessage = (content: string) => {
    setMessages((prev) => [...prev, { role: "user", content }]);
    chatMutation.mutate({ message: content, lessonId });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation(`/curriculum/${moduleId}`)}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Module
        </Button>

        <Button
          variant={isCompleted ? "outline" : "default"}
          size="sm"
          onClick={() =>
            toggleMutation.mutate({
              lessonId,
              moduleId,
              completed: !isCompleted,
            })
          }
          disabled={toggleMutation.isPending}
        >
          {isCompleted ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-1 text-primary" />
              Completed
            </>
          ) : (
            <>
              <Circle className="h-4 w-4 mr-1" />
              Mark Complete
            </>
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-3/4" />
        </div>
      ) : lesson ? (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Lesson content */}
          <div className="lg:col-span-3 space-y-4">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {lesson.title}
            </h1>
            {lesson.content ? (
              <Card className="bg-card border-brand-gold/15">
                <CardContent className="p-6 prose prose-invert prose-sm max-w-none [&_p]:leading-relaxed">
                  <ReactMarkdown>{lesson.content}</ReactMarkdown>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card border-brand-gold/15">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Content for this lesson is being prepared.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* AI Chat sidebar */}
          <div className="lg:col-span-2">
            <div className="sticky top-4">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">
                Ask Synapse about this lesson
              </h2>
              <AIChatBox
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={chatMutation.isPending}
                placeholder="Ask about this lesson..."
                height="500px"
                emptyStateMessage="Ask Synapse anything about this lesson"
                suggestedPrompts={[
                  "Summarize this lesson",
                  "Explain the key concepts",
                  "Give me a practice question",
                ]}
              />
            </div>
          </div>
        </div>
      ) : (
        <Card className="bg-card border-brand-gold/15">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Lesson not found.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
