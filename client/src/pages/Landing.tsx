import { Button } from "@/components/ui/button";
import { SignInButton } from "@clerk/clerk-react";
import {
  ChevronRight,
  Crosshair,
  ListChecks,
  BarChart3,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Bar — Login only, no nav links */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-gold" />
            <span className="text-lg font-bold tracking-tight">Synapse</span>
          </div>
          <SignInButton mode="modal">
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Login
            </button>
          </SignInButton>
        </div>
      </header>

      {/* ============================================================
          SECTION 1: HERO
      ============================================================ */}
      <section className="pt-28 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="uppercase text-sm font-semibold tracking-widest text-gold mb-4">
            For chiropractors tired of "tire-kicker" leads
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
            Stop Treating Everyone.{" "}
            <span className="text-gold">Start Attracting Your Ideal Patients.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Synapse is the AI-powered growth coach built specifically for
            chiropractors. Get 5-minute, laser-focused daily action steps that
            fill your tables with patients who actually value your care.
          </p>
          <div className="mt-10">
            <a href="#pricing">
              <Button
                size="lg"
                className="px-10 py-6 text-base font-semibold bg-gold text-background hover:bg-gold/90 shadow-lg shadow-gold/20 hover:shadow-xl hover:shadow-gold/30 transition-all"
              >
                Start Your Practice Transformation
                <ChevronRight className="h-5 w-5 ml-1" />
              </Button>
            </a>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Join chiropractors already automating their growth.
          </p>
        </div>
      </section>

      {/* ============================================================
          SECTION 2: AGITATION
      ============================================================ */}
      <section className="py-20 px-4 sm:px-6 border-t border-border/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center leading-tight">
            You didn't go to chiropractic college to become a{" "}
            <span className="text-gold">digital marketer.</span>
          </h2>
          <div className="mt-10 space-y-6 text-lg text-muted-foreground leading-relaxed">
            <p>Let's be honest. You are wasting time and money on:</p>
            <ul className="space-y-4 pl-1">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-destructive shrink-0" />
                <span>
                  <strong className="text-foreground">Expensive marketing agencies</strong>{" "}
                  that send you cheap leads who never show up.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-destructive shrink-0" />
                <span>
                  <strong className="text-foreground">Staring at a blank screen</strong>{" "}
                  wondering what to post on social media today.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-destructive shrink-0" />
                <span>
                  <strong className="text-foreground">Feeling paralyzed by "marketing overwhelm"</strong>{" "}
                  while your ideal patients go to the clinic down the street.
                </span>
              </li>
            </ul>
            <p className="text-foreground font-medium pt-4">
              You don't need another course you won't finish. You need{" "}
              <em className="text-gold not-italic font-bold">execution</em>.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3: SOLUTION
      ============================================================ */}
      <section className="py-20 px-4 sm:px-6 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Meet Synapse:{" "}
              <span className="text-gold">Your AI Marketing Director.</span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Synapse doesn't just teach you marketing; it hands you the exact
              playbook for <em>today</em>. Powered by advanced AI, it learns
              about your specific clinic, your regional draw, and your ideal
              patient profile, then feeds you daily, bite-sized action steps to
              attract them.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {/* Pillar 1 */}
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <div className="h-14 w-14 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-5">
                <Crosshair className="h-7 w-7 text-gold" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Laser-Focused Targeting
              </h3>
              <p className="text-muted-foreground leading-relaxed text-sm">
                AI-driven profiling to speak directly to the patients you want —
                whether that's corrective care, high-performance athletes, or
                specific local demographics.
              </p>
            </div>
            {/* Pillar 2 */}
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <div className="h-14 w-14 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-5">
                <ListChecks className="h-7 w-7 text-gold" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Daily Action Steps
              </h3>
              <p className="text-muted-foreground leading-relaxed text-sm">
                No more guessing. Log in, get your 5-minute daily task, execute,
                and get back to adjusting.
              </p>
            </div>
            {/* Pillar 3 */}
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <div className="h-14 w-14 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-5">
                <BarChart3 className="h-7 w-7 text-gold" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                High-Tech Accountability
              </h3>
              <p className="text-muted-foreground leading-relaxed text-sm">
                Smart tracking that ensures you are actually moving the needle on
                your practice revenue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 4: INSIDE THE APP
      ============================================================ */}
      <section className="py-20 px-4 sm:px-6 border-t border-border/30">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Look Over the Shoulder of a{" "}
            <span className="text-gold">7-Figure Practice.</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            See exactly how our AI breaks down complex marketing strategies into
            single daily actions.
          </p>
          <div className="mt-12 rounded-xl border border-border overflow-hidden shadow-2xl shadow-gold/5">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310419663030573991/FYfVsUdTarsjArAdvcj8n6/app-mockup-CU8M3kSS6idtsRNMGCqWRV.webp"
              alt="Synapse app dashboard showing AI coaching, daily tasks, and progress tracking"
              className="w-full h-auto"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 5: PRICING
      ============================================================ */}
      <section id="pricing" className="py-20 px-4 sm:px-6 border-t border-border/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Hire an AI Marketing Coach for Less Than the Cost of{" "}
              <span className="text-gold">One Missed Appointment.</span>
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 max-w-3xl mx-auto">
            {/* Monthly Plan */}
            <div className="rounded-xl border border-border bg-card p-8 flex flex-col">
              <h3 className="text-xl font-semibold text-foreground">
                Monthly Growth
              </h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold text-foreground">$74.99</span>
                <span className="text-muted-foreground ml-1">/month</span>
              </div>
              <ul className="space-y-3 text-sm text-muted-foreground mb-8 flex-1">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-gold shrink-0" />
                  Full AI Coaching Access
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-gold shrink-0" />
                  Daily Action Steps
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-gold shrink-0" />
                  Ideal Patient Profiling
                </li>
              </ul>
              <Button
                variant="outline"
                className="w-full py-5 text-base font-semibold"
                onClick={() => {
                  // Stripe checkout link will go here when keys are added
                  alert("Stripe integration coming soon. Contact us to get started.");
                }}
              >
                Start Monthly
              </Button>
            </div>

            {/* Annual Plan — Highlighted */}
            <div className="relative rounded-xl border-2 border-gold bg-card p-8 flex flex-col shadow-lg shadow-gold/10">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gold text-background text-xs font-bold rounded-full uppercase tracking-wider">
                Best Value
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                Annual Mastery
              </h3>
              <div className="mt-4 mb-2">
                <span className="text-4xl font-bold text-foreground">$749</span>
                <span className="text-muted-foreground ml-1">/year</span>
              </div>
              <p className="text-sm text-gold font-medium mb-6">
                Get 2 Months FREE
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground mb-8 flex-1">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-gold shrink-0" />
                  Full AI Coaching Access
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-gold shrink-0" />
                  Daily Action Steps
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-gold shrink-0" />
                  Ideal Patient Profiling
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-gold shrink-0" />
                  Priority Support
                </li>
              </ul>
              <Button
                className="w-full py-5 text-base font-semibold bg-gold text-background hover:bg-gold/90"
                onClick={() => {
                  // Stripe checkout link will go here when keys are added
                  alert("Stripe integration coming soon. Contact us to get started.");
                }}
              >
                Claim 2 Months Free
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 6: GUARANTEE
      ============================================================ */}
      <section className="py-20 px-4 sm:px-6 border-t border-border/30">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gold/10 mb-6">
            <ShieldCheck className="h-8 w-8 text-gold" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            The 14-Day{" "}
            <span className="text-gold">"Full Waiting Room"</span> Guarantee.
          </h2>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Try Synapse for 14 days. If the daily action steps haven't made
            marketing the easiest part of your day, cancel with one click. No
            awkward phone calls.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 border-t border-border/30">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-gold" />
            <span>Synapse</span>
          </div>
          <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
