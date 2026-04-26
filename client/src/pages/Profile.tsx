import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setBio((user as any).bio || "");
    }
  }, [user]);

  const utils = trpc.useUtils();

  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully");
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  const handleSave = () => {
    updateMutation.mutate({ name: name || undefined, bio: bio || undefined });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Profile
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">Email</Label>
            <Input
              id="email"
              value={user?.email || ""}
              disabled
              className="bg-muted text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Email is managed through your login provider.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">Display Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio" className="text-foreground">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              maxLength={500}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {bio.length}/500 characters
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full sm:w-auto"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Role</span>
            <span className="text-foreground capitalize">{user?.role || "user"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Member since</span>
            <span className="text-foreground">
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString()
                : "—"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Last sign in</span>
            <span className="text-foreground">
              {user?.lastSignedIn
                ? new Date(user.lastSignedIn).toLocaleDateString()
                : "—"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
