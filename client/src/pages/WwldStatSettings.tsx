import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { friendlyErrorMessage } from "@/lib/friendlyError";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Plus, Settings2, Trash2 } from "lucide-react";
import {
  BUILTIN_STATS,
  BUILTIN_STAT_KEYS,
  CUSTOM_STAT_NAME_MAX,
  CUSTOM_STAT_UNIT_MAX,
  MAX_CUSTOM_STATS,
} from "@shared/wwldStats";

type CustomDraft = { id?: number; tempKey: string; name: string; unit: string };

let tempCounter = 0;
const newTempKey = () => `new-${++tempCounter}`;

export default function WwldStatSettings() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const settingsQuery = trpc.wwld.getStatSettings.useQuery();

  const [enabled, setEnabled] = useState<Set<string>>(new Set(BUILTIN_STAT_KEYS));
  const [customs, setCustoms] = useState<CustomDraft[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!settingsQuery.data || loaded) return;
    setEnabled(new Set(settingsQuery.data.enabledBuiltinStats));
    setCustoms(
      settingsQuery.data.customStats.map((c) => ({
        id: c.id,
        tempKey: `id-${c.id}`,
        name: c.name,
        unit: c.unit ?? "",
      }))
    );
    setLoaded(true);
  }, [settingsQuery.data, loaded]);

  // Synchronous guard against double-taps before the button re-renders as disabled.
  const savingRef = useRef(false);
  const save = trpc.wwld.saveStatSettings.useMutation({
    onSettled: () => {
      savingRef.current = false;
    },
    onSuccess: () => {
      utils.wwld.getStatSettings.invalidate();
      utils.wwld.getHistory.invalidate();
      toast.success("Log Stats settings saved");
      setLocation("/wwld");
    },
    onError: (error) => {
      toast.error(friendlyErrorMessage(error, "Could not save your settings. Please try again."));
    },
  });

  const toggle = (key: string, checked: boolean) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const addCustom = () => {
    if (customs.length >= MAX_CUSTOM_STATS) return;
    setCustoms((prev) => [...prev, { tempKey: newTempKey(), name: "", unit: "" }]);
  };

  const updateCustom = (tempKey: string, patch: Partial<CustomDraft>) => {
    setCustoms((prev) => prev.map((c) => (c.tempKey === tempKey ? { ...c, ...patch } : c)));
  };

  const removeCustom = (tempKey: string) => {
    setCustoms((prev) => prev.filter((c) => c.tempKey !== tempKey));
  };

  const trimmedNames = customs.map((c) => c.name.trim());
  const hasBlankName = trimmedNames.some((n) => n === "");
  const nothingSelected = enabled.size === 0 && customs.length === 0;

  const handleSave = () => {
    if (savingRef.current) return;
    if (hasBlankName) {
      toast.error("Give each custom stat a name, or remove it.");
      return;
    }
    if (nothingSelected) {
      toast.error("Keep at least one stat checked (or add a custom stat).");
      return;
    }
    savingRef.current = true;
    save.mutate({
      enabledBuiltinStats: BUILTIN_STAT_KEYS.filter((k) => enabled.has(k)),
      customStats: customs.map((c) => ({
        ...(c.id !== undefined ? { id: c.id } : {}),
        name: c.name.trim(),
        unit: c.unit.trim() || null,
      })),
    });
  };

  return (
    <div className="readable min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b border-brand-gold/15 px-4 py-4">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link href="/wwld" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted" aria-label="Back to Log Stats">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Settings2 className="w-6 h-6 text-[var(--gold)]" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Log Stats Settings</h1>
            <p className="text-xs text-muted-foreground">Choose what shows up when you log your day</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {settingsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : settingsQuery.isError ? (
          <p className="text-sm text-destructive text-center py-8">Could not load your settings. Please refresh.</p>
        ) : (
          <>
            {/* Built-in stats */}
            <section className="bg-card border border-brand-gold/15 rounded-xl p-4 space-y-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">Stats to track</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Uncheck anything you don't track. It disappears from your daily log, but anything you already
                  logged stays saved and still shows in History.
                </p>
              </div>
              <div className="divide-y divide-border">
                {BUILTIN_STATS.map((stat) => {
                  const id = `stat-${stat.key}`;
                  return (
                    <label key={stat.key} htmlFor={id} className="flex min-h-14 items-center gap-4 py-3 cursor-pointer">
                      <Checkbox
                        id={id}
                        checked={enabled.has(stat.key)}
                        onCheckedChange={(checked) => toggle(stat.key, checked === true)}
                        className="size-6 border-2"
                      />
                      <span className="flex-1 text-base font-medium text-foreground">{stat.label}</span>
                      <span className="text-xs text-muted-foreground">{stat.alias}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Custom stats */}
            <section className="bg-card border border-brand-gold/15 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Your custom stats{" "}
                    <span className="text-muted-foreground font-normal">
                      ({customs.length}/{MAX_CUSTOM_STATS})
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add up to {MAX_CUSTOM_STATS} numbers you want to track yourself (for example "Reactivations"
                    or "Collections" with unit "$"). Removing one hides it from your log; its past numbers stay in
                    History.
                  </p>
                </div>
              </div>

              {customs.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No custom stats yet.</p>
              )}

              <div className="space-y-3">
                {customs.map((c, index) => (
                  <div key={c.tempKey} className="space-y-2 rounded-lg border border-border p-3">
                    <label className="block text-base font-semibold text-foreground" htmlFor={`custom-name-${c.tempKey}`}>
                      Custom stat {index + 1}
                    </label>
                    <Input
                      id={`custom-name-${c.tempKey}`}
                      className="h-12 text-base"
                      value={c.name}
                      maxLength={CUSTOM_STAT_NAME_MAX}
                      placeholder="Name, e.g. Reactivations"
                      onChange={(e) => updateCustom(c.tempKey, { name: e.target.value })}
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-12 flex-1 text-base"
                        value={c.unit}
                        maxLength={CUSTOM_STAT_UNIT_MAX}
                        placeholder="Unit (optional)"
                        aria-label={`Custom stat ${index + 1} unit`}
                        onChange={(e) => updateCustom(c.tempKey, { unit: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => removeCustom(c.tempKey)}
                        aria-label={`Remove custom stat ${index + 1}`}
                        className="h-12 border-2 border-border px-3 text-base"
                      >
                        <Trash2 className="w-5 h-5 mr-1" aria-hidden="true" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={addCustom}
                disabled={customs.length >= MAX_CUSTOM_STATS}
                className="w-full h-12 text-base border-2 border-[var(--gold)] text-[var(--gold)]"
              >
                <Plus className="w-4 h-4 mr-1" />
                {customs.length >= MAX_CUSTOM_STATS ? `Limit of ${MAX_CUSTOM_STATS} custom stats reached` : "Add custom stat"}
              </Button>
              <p className="text-[11px] text-muted-foreground">Custom stats are whole numbers.</p>
            </section>

            {nothingSelected && (
              <p className="text-xs text-destructive text-center">
                Keep at least one stat checked (or add a custom stat) so there is something to log.
              </p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12 text-base border-2 border-foreground/70" onClick={() => setLocation("/wwld")} disabled={save.isPending}>
                Cancel
              </Button>
              <Button
                className="flex-1 h-12 text-base bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-bold"
                onClick={handleSave}
                disabled={save.isPending || nothingSelected}
              >
                {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save settings
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
