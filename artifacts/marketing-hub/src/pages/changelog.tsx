import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Sparkles,
  Bug,
  Zap,
  Globe,
  Users,
  BarChart3,
  Settings,
  Moon,
  Sun,
  ArrowRight,
} from "lucide-react";
import { useDarkMode } from "@/lib/useDarkMode";

type ChangeType = "feature" | "improvement" | "fix" | "new";

type ChangeEntry = {
  type: ChangeType;
  text: string;
};

type Release = {
  version: string;
  date: string;
  title: string;
  summary: string;
  changes: ChangeEntry[];
};

const TYPE_CONFIG: Record<ChangeType, { label: string; className: string; icon: React.ReactNode }> = {
  new: {
    label: "New",
    className: "bg-primary/10 text-primary border-primary/20",
    icon: <Sparkles className="h-3 w-3" />,
  },
  feature: {
    label: "Feature",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    icon: <Zap className="h-3 w-3" />,
  },
  improvement: {
    label: "Improvement",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    icon: <BarChart3 className="h-3 w-3" />,
  },
  fix: {
    label: "Fix",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    icon: <Bug className="h-3 w-3" />,
  },
};

const RELEASES: Release[] = [
  {
    version: "2.8.0",
    date: "May 2026",
    title: "AI Chat Assistant + Notification Center",
    summary: "A major quality-of-life update — the app now has a real-time notification panel and a multi-turn AI chat assistant inside the AI Tools page.",
    changes: [
      { type: "new", text: "AI Chat Assistant: multi-turn conversation mode in AI Tools for context-aware content workflows" },
      { type: "new", text: "Notification Center: bell icon in sidebar with live lead and keyword rank alerts" },
      { type: "feature", text: "Integrations page: full public-facing catalog of every connected service" },
      { type: "feature", text: "Changelog page: version history now publicly accessible" },
      { type: "improvement", text: "Dark mode now respects system preference on first visit" },
      { type: "improvement", text: "Sidebar group collapse state persists across navigation" },
      { type: "improvement", text: "Landing page: added live URL input for instant SEO audit without signup" },
      { type: "improvement", text: "Competitor comparison table added to the marketing landing page" },
      { type: "improvement", text: "Pricing: added ₹/$ currency switcher" },
      { type: "fix", text: "Agency plan now correctly shows 'Unlimited websites' instead of '1 website'" },
      { type: "fix", text: "⌘K keyboard shortcut hint now visible in expanded sidebar" },
    ],
  },
  {
    version: "2.7.0",
    date: "April 2026",
    title: "Analytics Date Range + CSV Export",
    summary: "You can now filter analytics by custom date ranges and export leads and keywords to CSV with one click.",
    changes: [
      { type: "new", text: "Analytics: date range picker with quick presets (7d, 30d, 90d, custom)" },
      { type: "new", text: "Leads: one-click CSV export of entire lead table" },
      { type: "new", text: "Keywords: CSV export with current rank, URL, and volume" },
      { type: "feature", text: "A/B Tests: new dedicated page for managing split tests" },
      { type: "improvement", text: "Empty states added to all major pages with contextual CTAs" },
      { type: "fix", text: "Analytics chart no longer breaks when there's no data in range" },
    ],
  },
  {
    version: "2.6.0",
    date: "March 2026",
    title: "Settings Overhaul + BYOK",
    summary: "Settings page rebuilt with tabbed layout. Added Bring-Your-Own-Key support for OpenAI, Anthropic, and Gemini.",
    changes: [
      { type: "new", text: "Settings: fully tabbed layout (General, AI, Email, Billing, Security, Webhooks)" },
      { type: "new", text: "Bring Your Own AI Key (BYOK) for OpenAI, Anthropic, and Gemini on Growth+ plans" },
      { type: "new", text: "Webhook configurator: register endpoints for lead, campaign, and rank events" },
      { type: "feature", text: "Image generation: FLUX Schnell, FLUX Pro, Stable Diffusion 3.5, and Kling video" },
      { type: "improvement", text: "AI usage meter now visible in sidebar with per-model breakdown" },
      { type: "fix", text: "Email test connection now correctly handles SMTP TLS settings" },
    ],
  },
  {
    version: "2.5.0",
    date: "February 2026",
    title: "Google Integrations + Local SEO",
    summary: "Connect Google Search Console and GA4 for live traffic data. New Local SEO module for managing map listings.",
    changes: [
      { type: "new", text: "Google Search Console integration: impressions, clicks, CTR, and position data" },
      { type: "new", text: "Google Analytics 4 integration: sessions, bounce rate, and conversions" },
      { type: "new", text: "Local SEO page: manage NAP consistency, map rankings, and local citations" },
      { type: "new", text: "Content Brief generator: AI-powered briefs from a single keyword" },
      { type: "feature", text: "Competitor analysis: side-by-side keyword gap and backlink comparison" },
      { type: "improvement", text: "Command Palette (⌘K) added for quick navigation" },
    ],
  },
  {
    version: "2.4.0",
    date: "January 2026",
    title: "Campaigns + Lead Scoring",
    summary: "Full email campaign builder with open/click tracking. Automatic lead scoring based on activity.",
    changes: [
      { type: "new", text: "Email campaign builder: drag-and-drop composer with open and click tracking" },
      { type: "new", text: "Lead scoring: automatic score (0–100) based on pages visited, forms submitted, and emails opened" },
      { type: "new", text: "Outreach module: manage link-building campaigns with email sequences" },
      { type: "feature", text: "Conversations: unified inbox for lead chat and email replies" },
      { type: "improvement", text: "Backlinks table now supports bulk import from CSV" },
    ],
  },
];

export default function ChangelogPage() {
  const [, setLocation] = useLocation();
  const { dark, toggle } = useDarkMode();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            className="flex items-center gap-2 font-display font-bold text-lg"
            onClick={() => setLocation("/")}
          >
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span>SEO Command</span>
          </button>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/pricing")} className="hidden sm:inline-flex">
              Pricing
            </Button>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button size="sm" onClick={() => setLocation("/login")}>
              Sign In
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-sidebar text-sidebar-foreground py-14 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display mb-4">
            What's New
          </h1>
          <p className="text-sidebar-foreground/70 text-lg max-w-2xl mx-auto">
            Every feature, improvement, and fix — documented as it ships.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-12 sm:py-16 flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="space-y-12">
            {RELEASES.map((release, idx) => (
              <div key={release.version} className="relative">
                {/* Timeline line */}
                {idx < RELEASES.length - 1 && (
                  <div className="absolute left-[11px] top-8 bottom-0 w-px bg-border -mb-4" />
                )}

                <div className="flex gap-5">
                  {/* Timeline dot */}
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center mt-1 z-10 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                  </div>

                  <div className="flex-1 pb-2">
                    {/* Release header */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-muted-foreground">{release.date}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        v{release.version}
                      </Badge>
                    </div>
                    <h2 className="text-xl font-bold font-display mb-2">{release.title}</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-5">{release.summary}</p>

                    {/* Changes list */}
                    <div className="space-y-2">
                      {release.changes.map((change, i) => {
                        const cfg = TYPE_CONFIG[change.type];
                        return (
                          <div key={i} className="flex items-start gap-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] flex items-center gap-1 shrink-0 mt-0.5 ${cfg.className}`}
                            >
                              {cfg.icon}
                              {cfg.label}
                            </Badge>
                            <p className="text-sm text-foreground/80 leading-relaxed">{change.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-xl border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Want to be notified when new features ship?
            </p>
            <Button onClick={() => setLocation("/login")}>
              Create an account — it's free
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-display font-bold text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>SEO Command</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <button onClick={() => setLocation("/")} className="hover:text-foreground transition-colors">Home</button>
            <button onClick={() => setLocation("/integrations")} className="hover:text-foreground transition-colors">Integrations</button>
            <button onClick={() => setLocation("/pricing")} className="hover:text-foreground transition-colors">Pricing</button>
            <button onClick={() => setLocation("/login")} className="hover:text-foreground transition-colors font-medium text-primary">Sign In</button>
          </nav>
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} SEO Command</p>
        </div>
      </footer>
    </div>
  );
}
