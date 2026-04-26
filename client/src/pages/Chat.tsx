import { AIChatBox, Message } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";

export default function Chat() {
  const { data: chatHistory } = trpc.ai.history.useQuery({ lessonId: null });
  const [messages, setMessages] = useState<Message[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (chatHistory && !initialized) {
      const historyMessages: Message[] = chatHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));
      setMessages(historyMessages);
      setInitialized(true);
    }
  }, [chatHistory, initialized]);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.content },
      ]);
    },
  });

  const clearMutation = trpc.ai.clear.useMutation({
    onSuccess: () => {
      setMessages([]);
    },
  });

  const handleSendMessage = (content: string) => {
    setMessages((prev) => [...prev, { role: "user", content }]);
    chatMutation.mutate({ message: content, lessonId: null });
  };

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            AI Assistant
          </h1>
          <p className="text-muted-foreground mt-1">
            Ask Synapse anything about your curriculum.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => clearMutation.mutate({ lessonId: null })}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            disabled={clearMutation.isPending}
          >
            Clear history
          </button>
        )}
      </div>

      <AIChatBox
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={chatMutation.isPending}
        placeholder="Ask Synapse anything..."
        height="calc(100vh - 14rem)"
        emptyStateMessage="Start a conversation with Synapse"
        suggestedPrompts={[
          "What topics are covered in the curriculum?",
          "Help me understand a concept",
          "Give me a study tip",
          "Quiz me on what I've learned",
        ]}
      />
    </div>
  );
}
