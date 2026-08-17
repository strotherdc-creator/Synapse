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
  const [practiceName, setPracticeName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [workDays, setWorkDays] = useState("mon:full,tue:full,wed:full,thu:full,fri:full,sat:off,sun:off");

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setBio((user as any).bio || "");
      setPracticeName((user as any).practiceName || "");
      setCity((user as any).city || "");
      setState((user as any).state || "");
      setPhone((user as any).phone || "");
      setWebsite((user as any).website || "");
      setFacebookUrl((user as any).facebookUrl || "");
      setInstagramHandle((user as any).instagramHandle || "");
      setTiktokHandle((user as any).tiktokHandle || "");
      setWorkDays((user as any).workDays || "mon:full,tue:full,wed:full,thu:full,fri:full,sat:off,sun:off");
    }
  }, [user]);

  const utils = trpc.useUtils();

  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: () => { toast.success("Bio updated"); utils.auth.me.invalidate(); },
    onError: (error) => toast.error(error.message || "Failed to update"),
  });

  const updatePracticeMutation = trpc.profile.updatePractice.useMutation({
    onSuccess: () => { toast.success("Practice profile saved!"); utils.auth.me.invalidate(); },
    onError: (error) => toast.error(error.message || "Failed to save"),
  });

  const handleSavePractice = () => {
    if (!name.trim() || !practiceName.trim() || !city.trim() || !state.trim() || !phone.trim() || !website.trim()) {
      toast.error("Name, Practice Name, City, State, Phone, and Website are required.");
      return;
    }
    updatePracticeMutation.mutate({
      name: name.trim(),
      practiceName: practiceName.trim(),
      city: city.trim(),
      state: state.trim(),
      phone: phone.trim() || undefined,
      website: website.trim() || undefined,
      facebookUrl: facebookUrl.trim() || undefined,
      instagramHandle: instagramHandle.trim() || undefined,
      tiktokHandle: tiktokHandle.trim() || undefined,
      workDays: workDays,
    });
  };

  const isOnboarding = !(user as any)?.profileComplete;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {isOnboarding && (
        <div className="bg-blue-900/30 border-2 border-blue-500/40 rounded-2xl p-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to Synapse!</h2>
          <p className="text-lg text-blue-200">Complete your practice profile to get personalized content.</p>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Profile</h1>
        <p className="text-muted-foreground mt-1">Your practice info personalizes your daily content, posts, and scripts.</p>
      </div>

      {/* Practice Profile */}
      <Card className="bg-card border-2 border-emerald-500/30">
        <CardHeader>
          <CardTitle className="text-foreground text-xl">Practice Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground font-semibold">Your Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Jane Smith" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground font-semibold">Practice Name *</Label>
              <Input value={practiceName} onChange={(e) => setPracticeName(e.target.value)} placeholder="Smith Chiropractic" maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground font-semibold">City *</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="New Buffalo" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground font-semibold">State *</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="Michigan" maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground font-semibold">Phone *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(269) 555-0123" maxLength={30} />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground font-semibold">Website *</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://smithchiro.com" />
            </div>
          </div>

          <div className="pt-3 border-t border-border">
            <p className="text-sm font-semibold text-foreground mb-3">Social Media (for hashtags and post formatting)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Facebook URL</Label>
                <Input value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/yourpage" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Instagram</Label>
                <Input value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} placeholder="@yourhandle" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">TikTok</Label>
                <Input value={tiktokHandle} onChange={(e) => setTiktokHandle(e.target.value)} placeholder="@yourhandle" />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border">
            <p className="text-sm font-semibold text-foreground mb-3">Practice Schedule (which days do you see patients?)</p>
            <div className="space-y-2">
              {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((dayKey) => {
                const labels: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
                const schedule: Record<string, string> = {};
                workDays.split(",").forEach((entry) => {
                  const [d, s] = entry.split(":");
                  if (d) schedule[d] = s || "full";
                });
                const status = schedule[dayKey] || "off";
                const cycle = () => {
                  // Tap cycles: full → half → off → full
                  const next = status === "full" ? "half" : status === "half" ? "off" : "full";
                  schedule[dayKey] = next;
                  setWorkDays(Object.entries(schedule).map(([k, v]) => `${k}:${v}`).join(","));
                };
                return (
                  <div key={dayKey} className="flex items-center justify-between">
                    <span className="text-base font-semibold text-foreground w-24">{labels[dayKey]}</span>
                    <button
                      type="button"
                      onClick={cycle}
                      className={`px-4 py-2 rounded-lg font-bold text-sm min-w-[80px] transition-colors ${
                        status === "full" ? "bg-emerald-600 text-white" :
                        status === "half" ? "bg-yellow-600 text-white" :
                        "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {status === "full" ? "Full Day" : status === "half" ? "Half Day" : "Off"}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Tap to cycle: Full Day → Half Day → Off. Days off are excluded from trends. Half days are weighted 2x.</p>
          </div>

          <Button onClick={handleSavePractice} disabled={updatePracticeMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" size="lg">
            <Save className="h-5 w-5 mr-2" />
            {updatePracticeMutation.isPending ? "Saving..." : isOnboarding ? "Complete Profile & Get Started" : "Save Practice Profile"}
          </Button>
        </CardContent>
      </Card>

      {/* Bio */}
      {!isOnboarding && (
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-foreground">About You</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..." maxLength={500} rows={4} />
            <p className="text-xs text-muted-foreground">{bio.length}/500</p>
            <Button onClick={() => updateMutation.mutate({ name: name || undefined, bio: bio || undefined })} disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />{updateMutation.isPending ? "Saving..." : "Save Bio"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Account Details */}
      {!isOnboarding && (
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-foreground">Account Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="text-foreground">{user?.email || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Role</span>
              <span className="text-foreground capitalize">{user?.role || "user"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Member since</span>
              <span className="text-foreground">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
