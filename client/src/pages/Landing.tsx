import { Button } from "@/components/ui/button";
import { SignInButton } from "@clerk/clerk-react";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Zap,
  PenTool,
  Calendar,
} from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Bridge the Gap Curriculum",
    description:
      "Progress through the complete Bridge the Gap program — structured modules that build your unique positioning and differentiation strategy.",
  },
  {
    icon: Brain,
    title: "AI-Powered Coaching",
    description:
      "Get instant, context-aware coaching from Synapse — your AI assistant that knows your practice, your answers, and where you are in the curriculum.",
  },
  {
    icon: PenTool,
    title: "Content Studio",
    description:
      "Generate social posts, video scripts, patient stories, emails, and referral requests — all personalized to your unique positioning.",
  },
  {
    icon: Calendar,
    title: "Daily Routine & Streaks",
    description:
      "Build consistent habits with daily tasks, streak tracking, and progress milestones that keep you accountable.",
  },
  {
    icon: TrendingUp,
    title: "Track Your Progress",
    description:
      "See your completion percentage, mark lessons done, and pick up right where you left off every time you return.",
  },
  {
    icon: MessageSquare,
    title: "Ask Anything",
    description:
      "Stuck on a concept? Ask Synapse for a summary, explanation, or practice question — all tailored to your current lesson.",
  },
];

const benefits = [
  "Self-paced learning on your schedule",
  "AI coaching available 24/7",
  "Content generated from YOUR unique positioning",
  "Personalized responses based on your curriculum answers",
  "Daily routine to build consistent growth habits",
  "Track completion across every module",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">Synapse</span>
          </div>
          <SignInButton mode="modal">
            <Button size="sm">
              Sign in
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </SignInButton>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm mb-8">
            <Sparkles className="h-3.5 w-3.5" />
            AI-powered practice growth
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            Grow your practice with{" "}
            <span className="text-primary">Synapse</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            The Bridge the Gap curriculum platform with AI coaching, content
            generation, and daily routines — built to help healthcare
            practitioners differentiate and grow.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <SignInButton mode="modal">
              <Button
                size="lg"
                className="px-8 text-base shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
              >
                Get started
                <ChevronRight className="h-5 w-5 ml-1" />
              </Button>
            </SignInButton>
            <a
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Learn more
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="py-20 px-4 sm:px-6 border-t border-border/50"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Everything you need to differentiate and grow
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
              Synapse combines structured curriculum with intelligent coaching to
              help you build a practice that stands out.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-card p-8 hover:border-primary/40 transition-all"
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4 sm:px-6 border-t border-border/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Built for healthcare practitioners
              </h2>
              <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
                Whether you are a chiropractor, wellness professional, or
                recovery studio owner — Synapse helps you find your unique voice
                and grow your practice.
              </p>
            </div>
            <div className="space-y-4">
              {benefits.map((benefit) => (
                <div
                  key={benefit}
                  className="flex items-center gap-3 py-3 px-4 rounded-lg bg-card border border-border"
                >
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-foreground">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 border-t border-border/50">
        <div className="max-w-3xl mx-auto text-center">
          <Zap className="h-10 w-10 text-primary mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Ready to differentiate your practice?
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
            Sign in to access the full Bridge the Gap curriculum, AI coaching,
            content tools, and daily growth routines.
          </p>
          <SignInButton mode="modal">
            <Button
              size="lg"
              className="mt-8 px-10 text-base shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
            >
              Sign in and start growing
              <ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          </SignInButton>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 border-t border-border/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span>Synapse</span>
          </div>
          <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
