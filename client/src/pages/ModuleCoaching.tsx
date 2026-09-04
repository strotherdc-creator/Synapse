import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Send,
  Loader2,
  Sparkles,
  User,
  RotateCcw,
  Mic,
  MicOff,
  PartyPopper,
  BookOpen,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import ReactMarkdown from "react-markdown";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { Confetti } from "@/components/Confetti";

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

  // Fetch all modules to find the next one and check locking
  const { data: allModules } = trpc.modules.list.useQuery();

  // Guard: redirect if this module is locked (previous module not complete)
  useEffect(() => {
    if (!allModules || allModules.length === 0) return;
    const sorted = [...allModules].sort((a, b) => a.sortOrder - b.sortOrder);
    const currentIdx = sorted.findIndex((m) => m.id === moduleId);
    if (currentIdx <= 0) return; // First module or not found — allow
    const prevModule = sorted[currentIdx - 1];
    // Must match Curriculum unlock: moduleComplete (coaching when steps exist, else lessons)
    if (!prevModule?.moduleComplete) {
      setLocation("/curriculum");
    }
  }, [allModules, moduleId, setLocation]);

  const nextModule = useMemo(() => {
    if (!allModules || !mod) return null;
    const sorted = [...allModules].sort((a, b) => a.sortOrder - b.sortOrder);
    const currentIdx = sorted.findIndex((m) => m.id === moduleId);
    if (currentIdx >= 0 && currentIdx < sorted.length - 1) {
      return sorted[currentIdx + 1];
    }
    return null;
  }, [allModules, mod, moduleId]);

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
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiShownRef = useRef(false);

  // Trigger confetti once when module becomes complete
  useEffect(() => {
    if (allComplete && !confettiShownRef.current) {
      confettiShownRef.current = true;
      setShowConfetti(true);
    }
  }, [allComplete]);

  // Chat for the active step
  const { data: chatHistory, refetch: refetchChat } =
    trpc.coaching.getStepChat.useQuery(
      { stepId: activeStepId! },
      { enabled: !!activeStepId }
    );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInitialized, setChatInitialized] = useState(false);
  const [input, setInput] = useState("");
  const [showLessonGuide, setShowLessonGuide] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  // ── Voice dictation ──
  const {
    isListening,
    fullTranscript,
    interimText,
    isSupported: speechSupported,
    toggleListening,
    resetTranscript,
  } = useSpeechToText();

  // Track what was in the input BEFORE the user started speaking
  const inputBeforeSpeechRef = useRef("");

  // When user starts listening, capture the current input
  useEffect(() => {
    if (isListening) {
      inputBeforeSpeechRef.current = input;
    }
  }, [isListening]); // eslint-disable-line react-hooks/exhaustive-deps

  // When speech recognition produces final text, update the input
  // (replace the speech portion, don't append)
  useEffect(() => {
    if (isListening || fullTranscript) {
      const base = inputBeforeSpeechRef.current;
      const separator = base && !base.endsWith(" ") && fullTranscript ? " " : "";
      setInput(base + separator + fullTranscript);
    }
  }, [fullTranscript, isListening]);

  // When user stops listening, commit the text and reset the hook
  const prevListeningRef = useRef(false);
  useEffect(() => {
    if (prevListeningRef.current && !isListening) {
      // Stopped listening — text is already in input, just reset the hook
      resetTranscript();
    }
    prevListeningRef.current = isListening;
  }, [isListening, resetTranscript]);

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

  // Initialize chat messages from history, or auto-start if no history
  useEffect(() => {
    if (chatHistory && !chatInitialized) {
      if (chatHistory.length > 0) {
        // Filter out the auto-start "Let's get started" user messages — they're invisible triggers
        const historyMessages: ChatMessage[] = chatHistory
          .filter((msg) => !(msg.role === "user" && msg.content.trim().toLowerCase() === "let's get started"))
          .map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          }));
        setMessages(historyMessages);
      } else if (activeStepId && !chatMutation.isPending) {
        // No history — silently auto-start the conversation (don't show the trigger message)
        chatMutation.mutate({ stepId: activeStepId, message: "Let's get started" });
      }
      setChatInitialized(true);
    }
  }, [chatHistory, chatInitialized, activeStepId]);

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

  // Preserve the reader's place when the mobile keyboard changes viewport size.
  // Previously, this effect forced the chat to the bottom and hid lesson context.

  // Chat mutation
  const chatMutation = trpc.coaching.chat.useMutation({
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.content },
      ]);
    },
    onError: (error) => {
      console.error("[Coaching chat error]", error.message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I wasn\u2019t able to respond. Please try again in a moment.",
        },
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
    onError: (error) => {
      console.error("[Confirm answer error]", error.message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, there was an error saving your answer. Please try again.",
        },
      ]);
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
    if (!activeStepId || !content.trim() || chatMutation.isPending) return;
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

  const hasAssistantMessage = messages.some((m) => m.role === "assistant");
  const lessonGuideMessage = messages.find((m) => m.role === "assistant");
  const savedSteps = steps?.filter((step) => step.completed && step.finalAnswer) ?? [];

  const handleAskAboutLesson = () => {
    setShowLessonGuide(false);
    setInput((current) => current || "Could you clarify what this lesson is asking me to do?");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleConfirmAnswer = () => {
    if (!activeStepId || !activeStep) return;
    // Prefer last user message as the "answer", fall back to last assistant message
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const finalAnswer = lastUser?.content || lastAssistant?.content;
    if (finalAnswer) {
      completeMutation.mutate({
        stepId: activeStepId,
        moduleId,
        finalAnswer,
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
        <Card className="bg-card border-brand-gold/15">
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
      <div className="shrink-0 rounded-t-lg bg-card border border-brand-gold/15 px-4 py-3">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLessonGuide(true)}
              className="h-8 gap-1 px-2 text-xs border-brand-gold/30"
              title="Review this lesson and your saved answers"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Guide
            </Button>
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
        className="flex-1 overflow-y-auto border-x border-brand-gold/15 bg-card/50"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {messages.length === 0 && !chatMutation.isPending ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
            <p className="text-muted-foreground" style={{ fontSize: "15px" }}>
              Starting your coaching session...
            </p>
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
                      ? "bg-brand-gold/20 text-gold border border-brand-gold/30"
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
      <div className="shrink-0 border border-brand-gold/15 rounded-b-lg bg-card">

        {/* Confetti celebration overlay */}
        {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

        {/* Module complete — celebration + next module navigation */}
        {allComplete ? (
          <div className="px-3 py-4 space-y-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-lg font-bold" style={{ color: "oklch(0.78 0.14 80)" }}>
                <PartyPopper className="h-6 w-6" />
                Module Complete!
                <PartyPopper className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                You’ve finished all {totalSteps} steps. Great work!
              </p>
            </div>
            {nextModule ? (
              <button
                onClick={() => setLocation(`/curriculum/${nextModule.id}/coaching`)}
                className="w-full flex items-center justify-center gap-2 rounded-lg py-3.5 px-4 text-base font-semibold transition-colors"
                style={{
                  backgroundColor: "oklch(0.78 0.14 80)",
                  color: "#1a1a1a",
                }}
              >
                Continue to {nextModule.title}
                <ArrowRight className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={() => setLocation("/curriculum")}
                className="w-full flex items-center justify-center gap-2 rounded-lg py-3.5 px-4 text-base font-semibold transition-colors"
                style={{
                  backgroundColor: "oklch(0.78 0.14 80)",
                  color: "#1a1a1a",
                }}
              >
                Back to Curriculum
                <ArrowRight className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={() => setLocation("/curriculum")}
              className="w-full text-center text-sm text-muted-foreground underline hover:text-foreground py-1"
            >
              Return to Curriculum
            </button>
          </div>
        ) : (
          /* Normal input area — only show when module is NOT complete */
          <div className="flex flex-col gap-0">

            {/* Step 1: Type your answer */}
            <div className="px-3 pt-3 pb-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Step 1 — Type your answer, then tap Send
              </p>
              <form onSubmit={handleSubmit} className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  value={isListening ? input + (interimText ? " " + interimText : "") : input}
                  onChange={(e) => { if (!isListening) setInput(e.target.value); }}
                  onKeyDown={handleKeyDown}
                  placeholder={isListening ? "Listening..." : "Type your answer here..."}
                  className="flex-1 max-h-28 resize-none min-h-[44px] text-base"
                  rows={1}
                  readOnly={isListening}
                />
                {speechSupported && (
                  <Button
                    type="button"
                    size="icon"
                    variant={isListening ? "destructive" : "outline"}
                    onClick={toggleListening}
                    className={`shrink-0 h-[44px] w-[44px] ${
                      isListening ? "animate-pulse" : ""
                    }`}
                    title={isListening ? "Stop recording" : "Start voice input"}
                  >
                    {isListening ? (
                      <MicOff className="h-5 w-5" />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={!input.trim() || chatMutation.isPending || isListening}
                  className="shrink-0 h-[44px] px-4 gap-1.5 font-semibold"
                  style={{ backgroundColor: "oklch(0.55 0.18 145)", color: "#fff" }}
                >
                  {chatMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send
                </Button>
              </form>
            </div>

            {/* Step 2: Confirm when satisfied */}
            {hasAssistantMessage && !activeStep?.completed && (
              <div className="px-3 pt-1 pb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Step 2 — Happy with your answer? Save &amp; continue
                </p>
                <button
                  onClick={handleConfirmAnswer}
                  disabled={completeMutation.isPending || chatMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-3 px-4 text-base font-semibold transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: "oklch(0.78 0.14 80)",
                    color: "#1a1a1a",
                  }}
                >
                  {completeMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                  Save &amp; Continue
                </button>
              </div>
            )}

          </div>
        )}
      </div>

      <Dialog open={showLessonGuide} onOpenChange={setShowLessonGuide}>
        <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto border-brand-gold/25 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <BookOpen className="h-5 w-5 text-[var(--gold)]" />
              Lesson Guide
            </DialogTitle>
            <DialogDescription>
              Keep this open whenever you need to reread the lesson while working on your answer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <section className="rounded-xl border border-brand-gold/20 bg-background/40 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Current step</p>
              <h3 className="mt-1 text-base font-semibold text-foreground">{activeStep?.title ?? "Coaching step"}</h3>
              {activeStep?.description && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{activeStep.description}</p>
              )}
            </section>

            <section className="rounded-xl border border-brand-gold/20 bg-background/40 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">What this lesson is asking</p>
              {lessonGuideMessage ? (
                <div className="prose prose-sm dark:prose-invert mt-3 max-w-none [&_p]:leading-relaxed [&_li]:leading-relaxed">
                  <ReactMarkdown>{lessonGuideMessage.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The coach is preparing your step guidance. You can return here once it appears.
                </p>
              )}
            </section>

            {activeStep?.finalAnswer && (
              <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-400">Your saved answer</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{activeStep.finalAnswer}</p>
              </section>
            )}

            {savedSteps.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Completed answers in this module</p>
                {savedSteps.map((step) => (
                  <button
                    key={step.id}
                    onClick={() => {
                      setActiveStepId(step.id);
                      setShowLessonGuide(false);
                    }}
                    className="w-full rounded-lg border border-brand-gold/15 bg-background/40 p-3 text-left hover:border-brand-gold/40"
                  >
                    <p className="text-sm font-semibold text-foreground">Step {step.stepNumber}: {step.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{step.finalAnswer}</p>
                  </button>
                ))}
              </section>
            )}

            <Button onClick={handleAskAboutLesson} className="w-full gap-2 bg-[var(--gold)] text-black hover:bg-[var(--gold)]/90">
              Ask coach about this lesson
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
