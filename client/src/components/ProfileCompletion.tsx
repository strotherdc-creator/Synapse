import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Full-screen profile completion gate.
 * Shown when a user has no name set. Once they submit, it never appears again.
 */
export default function ProfileCompletion() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const utils = trpc.useUtils();

  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile saved! Welcome to Synapse.");
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save profile");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Please enter your name");
      return;
    }
    updateMutation.mutate({ name: trimmed });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / Brand */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-lg bg-gold/20 flex items-center justify-center">
              <span className="text-gold text-xl font-bold">S</span>
            </div>
            <span className="text-2xl font-bold text-foreground">Synapse</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            Complete Your Profile
          </h1>
          <p className="text-muted-foreground text-sm">
            Before we get started, we need your name so your AI coach can personalize your experience.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 bg-card border border-border rounded-xl p-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                className="bg-muted text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                From your Google account.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Jane Smith"
                maxLength={100}
                autoFocus
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={updateMutation.isPending || !name.trim()}
            className="w-full bg-gold hover:bg-gold/90 text-black font-semibold"
          >
            {updateMutation.isPending ? "Saving..." : "Continue to Synapse"}
          </Button>
        </form>
      </div>
    </div>
  );
}
