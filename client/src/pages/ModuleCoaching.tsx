import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  // ── Keyboard-aware height ──
  // On mobile, when the virtual keyboard opens, the visual viewport shrinks.
  // We track this and set a CSS variable so the layout stays within the visible area.
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      setViewportHeight(vv.height);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

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

  // Auto-scroll chat to bottom
  const scrollToBottom = useCallback(() => {
    const el = chatContainerRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Also scroll when keyboard opens/closes
  useEffect(() => {
    scrollToBottom();
  }, [viewportHeight, scrollToBottom]);

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

  // Use visualViewport height when available (handles mobile keyboard),
  // otherwise fall back to 100dvh via CSS.
  // Mobile: header=56px + padding=16px (p-2 top+bottom) = 72px
  // Desktop: sidebar layout, padding=32px (p-4 top+bottom) = 32px
  const headerOffset = 72; // mobile header + padding
  const heightStyle: React.CSSProperties = viewportHeight
    ? { height: `${viewportHeight - headerOffset}px` }
    : { height: `calc(100dvh - ${headerOffset}px)` };

  return (
    <div
      ref={outerRef}
      className="flex flex-col overflow-hidden"
      style={{
        ...heightStyle,
        // Prevent body scroll when keyboard is open
        position: "relative",
      }}
    >
      {/* ── Compact Header ── */}
      <div className="shrink-0 pb-2">
        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => setLocation("/curriculum")}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm py-1"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Curriculum</span>
          </button>
          {allComplete && (
            <div
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: "var(--gold)" }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Complete
            </div>
          )}
        </div>

        <h1 className="text-lg font-bold tracking-tight text-foreground leading-tight">
          {mod?.title || "Module"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Step {activeStepIndex + 1} of {totalSteps} &middot; {completedSteps}{" "}
          completed
        </p>

        {/* Step progress pills */}
        <div className="flex gap-1.5 mt-2">
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

      {/* ── Step Title + Description (sticky, always visible) ── */}
      <div className="shrink-0 rounded-t-lg bg-card border border-border px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{ backgroundColor: "oklch(0.78 0.14 80 / 0.15)" }}
            >
              <Sparkles className="h-4.5 w-4.5" style={{ color: "var(--gold)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground leading-snug" style={{ fontSize: "17px" }}>
                {activeStep?.title || "Step"}
              </p>
              <p
                className="text-muted-foreground mt-1 leading-relaxed"
                style={{ fontSize: "14px" }}
              >
                {activeStep?.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (activeStepId)
                    clearChatMutation.mutate({ stepId: activeStepId });
                }}
                disabled={clearChatMutation.isPending}
                className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                title="Restart this conversation"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            {activeStep?.completed && (
              <span className="text-xs text-primary font-medium flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Chat Messages (scrollable middle section) ── */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto border-x border-border bg-card/50"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {messages.length === 0 && !chatMutation.isPending ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground/20" />
            <div>
              <p className="text-muted-foreground mb-4" style={{ fontSize: "15px" }}>
                Ready to start? Tap below to begin this step.
              </p>
              <Button
                variant="outline"
                size="default"
                onClick={() => handleSend("Let's get started")}
                className="text-base px-6 py-2.5"
              >
                Let's get started
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-2.5 ${
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
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:leading-relaxed [&_p]:mb-2 last:[&_p]:mb-0 [&_li]:leading-relaxed" style={{ fontSize: "15px" }}>
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed" style={{ fontSize: "15px" }}>
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
              <div className="flex items-start gap-2.5">
                <div
                  className="h-8 w-8 shrink-0 mt-1 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: "oklch(0.45 0.12 155 / 0.15)",
                  }}
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-2xl bg-muted px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Input + Confirm (pinned to bottom) ── */}
      <div className="shrink-0 border border-border rounded-b-lg bg-card">
        {/* Confirm answer button */}
        {messages.length >= 2 && !activeStep?.completed && (
          <div className="px-3 pt-2.5 pb-0.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleConfirmAnswer}
              disabled={completeMutation.isPending || chatMutation.isPending}
              className="w-full border-primary/30 text-primary hover:bg-primary/10 hover:text-primary text-sm py-2"
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

        <form onSubmit={handleSubmit} className="flex gap-2 p-3 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              // When input is focused on mobile, scroll chat to bottom after keyboard opens
              setTimeout(scrollToBottom, 300);
            }}
            placeholder="Type your response..."
            className="flex-1 max-h-28 resize-none min-h-[44px] text-base"
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || chatMutation.isPending}
            className="shrink-0 h-[44px] w-[44px]"
          >
            {chatMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
