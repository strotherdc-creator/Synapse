import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Loader2, PenTool, History, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const contentTypes = [
  { value: "social_post", label: "Social Media Post", description: "Facebook, Instagram, or LinkedIn post" },
  { value: "video_script", label: "Video Script", description: "60-90 second social media video" },
  { value: "patient_story", label: "Patient Story", description: "Anonymized success story" },
  { value: "email", label: "Email", description: "Patient or prospect email" },
  { value: "text_message", label: "Text Message", description: "Brief patient communication" },
  { value: "referral_request", label: "Referral Request", description: "Ask patients for referrals" },
] as const;

type ContentType = (typeof contentTypes)[number]["value"];

export default function ContentStudio() {
  const [contentType, setContentType] = useState<ContentType>("social_post");
  const [topic, setTopic] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");

  const generateMutation = trpc.content.generate.useMutation({
    onSuccess: (data) => {
      setGeneratedContent(data.content);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const historyQuery = trpc.content.history.useQuery();

  const handleGenerate = () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }
    generateMutation.mutate({
      contentType,
      topic: topic.trim(),
      additionalContext: additionalContext.trim() || undefined,
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Content Studio</h1>
        <p className="text-muted-foreground mt-1">
          Generate personalized marketing content based on your unique positioning.
        </p>
      </div>

      <Tabs defaultValue="generate" className="space-y-6">
        <TabsList>
          <TabsTrigger value="generate" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PenTool className="h-5 w-5 text-primary" />
                Create Content
              </CardTitle>
              <CardDescription>
                Choose a content type and topic. The AI will use your curriculum
                answers to personalize the output.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Content Type</label>
                <Select value={contentType} onValueChange={(v) => setContentType(v as ContentType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contentTypes.map((ct) => (
                      <SelectItem key={ct.value} value={ct.value}>
                        <div>
                          <span className="font-medium">{ct.label}</span>
                          <span className="text-muted-foreground ml-2 text-xs">
                            — {ct.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Topic</label>
                <Textarea
                  placeholder="e.g., Benefits of corrective chiropractic care for desk workers"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Additional Context{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Textarea
                  placeholder="Any specific angle, tone, or details you want included..."
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !topic.trim()}
                className="w-full"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Content
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {generatedContent && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">Generated Content</CardTitle>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{generatedContent}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Content History</CardTitle>
              <CardDescription>Your previously generated content</CardDescription>
            </CardHeader>
            <CardContent>
              {historyQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : historyQuery.data?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No content generated yet. Create your first piece above!
                </p>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {historyQuery.data?.map((item) => (
                      <div
                        key={item.id}
                        className="border rounded-lg p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium uppercase tracking-wider text-primary">
                            {item.contentType.replace("_", " ")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{item.prompt}</p>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                          <ReactMarkdown>
                            {item.generatedContent.slice(0, 300) +
                              (item.generatedContent.length > 300 ? "..." : "")}
                          </ReactMarkdown>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(item.generatedContent);
                            toast.success("Copied to clipboard");
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
