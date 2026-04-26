import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Send,
  Loader2,
  Sparkles,
  User,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import ReactMarkdown from "react-markdown";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function ModuleCoaching() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = parseInt(params.moduleId || "0");
  const [, setLocation] = useLocation();

  // Fetch module info
  const { data: mod } = trpc.modules.getById.useQuery({ id: moduleId });

  // Fetch coaching steps for this module
  const { data: steps, isLoading: stepsLoading } =
    trpc.coaching.getSteps.useQuery({ moduleId });

  // Track which step the user is currently on
  const [activeStepId, setActiveStepId] = useState<number | null>(null);

  // Set initial active step to the first incomplete step
  useEffect(() => {
    if (steps && steps.length > 0 && activeStepId === null) {
      const firstIncomplete = steps.find((s) => !s.completed);
      setActiveStepId(firstIncomplete?.id ?? steps[steps.length - 1].id);
    }
  }, [steps, activeStepId]);

  const activeStep = steps?.find((s) => s.id === activeStepId);
  const activeStepIndex = steps?.findIndex((s) => s.id === activeStepId) ?? -1;
  const totalSteps = steps?.length ?? 0;
  const completedSteps = steps?.filter((s) => s.completed).length ?? 0;
  const allComplete = completedSteps === totalSteps && totalSteps > 0;

  // Chat for the active step
  const { data: chatHistory, refetch: refetchChat } =
    trpc.coaching.getStepChat.useQuery(
      { stepId: activeStepId! },
      { enabled: !!activeStepId }
    );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInitialized, setChatInitialized] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const utils = trpc.useUtils();

  // Initialize chat messages from history
  useEffect(() => {
    if (chatHistory && !chatInitialized) {
      const historyMessages: ChatMessage[] = chatHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));
      setMessages(historyMessages);
      setChatInitialized(true);
    }
  }, [chatHistory, chatInitialized]);

  // Reset chat when step changes
  useEffect(() => {
    setChatInitialized(false);
    setMessages([]);
  }, [activeStepId]);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    const viewport = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLDivElement;
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Chat mutation
  const chatMutation = trpc.coaching.chat.useMutation({
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.content },
      ]);
    },
  });

  // Complete step mutation
  const completeMutation = trpc.coaching.completeStep.useMutation({
    onSuccess: () => {
      utils.coaching.getSteps.invalidate({ moduleId });
      utils.coaching.getModuleProgress.invalidate({ moduleId });
      utils.modules.list.invalidate();
      // Move to next step
      if (steps && activeStepIndex < steps.length - 1) {
        const nextStep = steps[activeStepIndex + 1];
        setActiveStepId(nextStep.id);
      }
    },
  });

  // Clear chat mutation
  const clearChatMutation = trpc.coaching.clearStepChat.useMutation({
    onSuccess: () => {
      setMessages([]);
      setChatInitialized(false);
      refetchChat();
    },
  });

  const handleSend = (content: string) => {
    if (!activeStepId || !content.trim()) return;
    const trimmed = content.trim();
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    chatMutation.mutate({ stepId: activeStepId, message: trimmed });
    scrollToBottom();
    textareaRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const handleConfirmAnswer = () => {
    if (!activeStepId || !activeStep) return;
    // Use the last assistant message as the final answer summary
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (lastAssistant) {
      completeMutation.mutate({
        stepId: activeStepId,
        moduleId,
        finalAnswer: lastAssistant.content,
      });
    }
  };

  if (stepsLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!steps || steps.length === 0) {
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
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Coaching steps are being prepared for this module. Check back
              soon!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] md:h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="shrink-0 pb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/curriculum")}
          className="text-muted-foreground hover:text-foreground -ml-2 mb-3"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Curriculum
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {mod?.title || "Module"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Step {activeStepIndex + 1} of {totalSteps} &middot;{" "}
              {completedSteps} completed
            </p>
          </div>
          {allComplete && (
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--gold)" }}>
              <CheckCircle2 className="h-5 w-5" />
              Module Complete
            </div>
          )}
        </div>

        {/* Step progress pills */}
        <div className="flex gap-1.5 mt-3">
          {steps.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => setActiveStepId(step.id)}
              className={`flex-1 h-2 rounded-full transition-all ${
                step.completed
                  ? "bg-primary"
                  : step.id === activeStepId
                    ? "bg-primary/50"
                    : "bg-muted"
              }`}
              title={`Step ${idx + 1}: ${step.title}`}
            />
          ))}
        </div>
      </div>

      {/* Main content area — step sidebar + chat */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Step list sidebar (desktop only) */}
        <div className="hidden lg:flex flex-col w-64 shrink-0">
          <Card className="bg-card border-border flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-3 space-y-1">
                {steps.map((step, idx) => {
                  const isActive = step.id === activeStepId;
                  return (
                    <button
                      key={step.id}
                      onClick={() => setActiveStepId(step.id)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        isActive
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="shrink-0 mt-0.5">
                          {step.completed ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : isActive ? (
                            <div className="h-4 w-4 rounded-full border-2 border-primary" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium leading-tight ${
                              isActive
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {step.title}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Step title bar */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-card border border-border rounded-t-lg">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--gold)", opacity: 0.15 }}
              >
                <Sparkles className="h-4 w-4" style={{ color: "var(--gold)" }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {activeStep?.title || "Step"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {activeStep?.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (activeStepId) clearChatMutation.mutate({ stepId: activeStepId });
                  }}
                  disabled={clearChatMutation.isPending}
                  className="text-muted-foreground hover:text-foreground h-8 px-2"
                  title="Restart this conversation"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
              {activeStep?.completed && (
                <span className="text-xs text-primary font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Done
                </span>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 border-x border-border bg-card/50 overflow-hidden">
            <div ref={scrollRef} className="h-full">
              {messages.length === 0 && !chatMutation.isPending ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                  <Sparkles className="h-10 w-10 text-muted-foreground/20" />
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Ready to start? Send a message to begin this step.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSend("Let's get started")}
                      className="text-sm"
                    >
                      Let's get started
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="flex flex-col space-y-4 p-4">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex gap-3 ${
                          message.role === "user"
                            ? "justify-end items-start"
                            : "justify-start items-start"
                        }`}
                      >
                        {message.role === "assistant" && (
                          <div
                            className="h-8 w-8 shrink-0 mt-1 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: "oklch(0.45 0.12 155 / 0.15)",
                            }}
                          >
                            <Sparkles className="h-4 w-4 text-primary" />
                          </div>
                        )}

                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          {message.role === "assistant" ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown>{message.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap text-sm">
                              {message.content}
                            </p>
                          )}
                        </div>

                        {message.role === "user" && (
                          <div className="h-8 w-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                            <User className="h-4 w-4 text-secondary-foreground" />
                          </div>
                        )}
                      </div>
                    ))}

                    {chatMutation.isPending && (
                      <div className="flex items-start gap-3">
                        <div
                          className="h-8 w-8 shrink-0 mt-1 rounded-full flex items-center justify-center"
                          style={{
                            backgroundColor: "oklch(0.45 0.12 155 / 0.15)",
                          }}
                        >
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <div className="rounded-lg bg-muted px-4 py-2.5">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          {/* Input + confirm area */}
          <div className="shrink-0 border border-border rounded-b-lg bg-card">
            {/* Confirm answer button — shows when there are messages and step isn't complete */}
            {messages.length >= 2 && !activeStep?.completed && (
              <div className="px-4 pt-3 pb-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleConfirmAnswer}
                  disabled={completeMutation.isPending || chatMutation.isPending}
                  className="w-full border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  {completeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Confirm my answer &amp; move to next step
                </Button>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="flex gap-2 p-3 items-end"
            >
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response..."
                className="flex-1 max-h-32 resize-none min-h-9"
                rows={1}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || chatMutation.isPending}
                className="shrink-0 h-[38px] w-[38px]"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
