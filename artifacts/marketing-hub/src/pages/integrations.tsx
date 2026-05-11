import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Globe,
  BarChart3,
  Mail,
  CreditCard,
  Sparkles,
  Search,
  Zap,
  Moon,
  Sun,
  ExternalLink,
} from "lucide-react";
import { useDarkMode } from "@/lib/useDarkMode";

type Integration = {
  name: string;
  description: string;
  category: string;
  status: "live" | "beta" | "coming-soon";
  icon: React.ReactNode;
  iconBg: string;
};

const INTEGRATIONS: Integration[] = [
  {
    name: "Google Search Console",
    description: "Pull live impressions, clicks, CTR, and position data directly into your analytics dashboard.",
    category: "SEO",
    status: "live",
    icon: <Search className="h-5 w-5 text-blue-600" />,
    iconBg: "bg-blue-500/10",
  },
  {
    name: "Google Analytics 4",
    description: "Connect GA4 to see traffic sources, sessions, bounce rate, and goal completions in one view.",
    category: "Analytics",
    status: "live",
    icon: <BarChart3 className="h-5 w-5 text-orange-600" />,
    iconBg: "bg-orange-500/10",
  },
  {
    name: "Google PageSpeed",
    description: "Run Core Web Vitals checks and PageSpeed scores directly inside any website audit.",
    category: "SEO",
    status: "live",
    icon: <Zap className="h-5 w-5 text-yellow-600" />,
    iconBg: "bg-yellow-500/10",
  },
  {
    name: "OpenAI",
    description: "Plug in your own OpenAI API key for unlimited GPT-4 content generation with no monthly cap.",
    category: "AI",
    status: "live",
    icon: <Sparkles className="h-5 w-5 text-violet-600" />,
    iconBg: "bg-violet-500/10",
  },
  {
    name: "Anthropic Claude",
    description: "Use Claude 3 models for longer-form content, code, and analysis tasks in AI Tools.",
    category: "AI",
    status: "live",
    icon: <Sparkles className="h-5 w-5 text-amber-600" />,
    iconBg: "bg-amber-500/10",
  },
  {
    name: "Gemini",
    description: "Google's Gemini models for multilingual content and multimodal AI workflows.",
    category: "AI",
    status: "live",
    icon: <Sparkles className="h-5 w-5 text-teal-600" />,
    iconBg: "bg-teal-500/10",
  },
  {
    name: "SendGrid",
    description: "Deliver transactional and campaign emails through Twilio SendGrid's reliable infrastructure.",
    category: "Email",
    status: "live",
    icon: <Mail className="h-5 w-5 text-blue-500" />,
    iconBg: "bg-blue-500/10",
  },
  {
    name: "Mailgun",
    description: "High-deliverability email sending with Mailgun API — supports custom sending domains.",
    category: "Email",
    status: "live",
    icon: <Mail className="h-5 w-5 text-red-600" />,
    iconBg: "bg-red-500/10",
  },
  {
    name: "Resend",
    description: "Modern email API built for developers — clean logs, React email templates, and great deliverability.",
    category: "Email",
    status: "live",
    icon: <Mail className="h-5 w-5 text-slate-700 dark:text-slate-300" />,
    iconBg: "bg-slate-500/10",
  },
  {
    name: "Mailchimp (Mandrill)",
    description: "Send transactional emails via Mandrill API for teams already using Mailchimp.",
    category: "Email",
    status: "live",
    icon: <Mail className="h-5 w-5 text-yellow-700" />,
    iconBg: "bg-yellow-500/10",
  },
  {
    name: "Stripe",
    description: "Accept card payments and manage subscriptions via Stripe's global payment infrastructure.",
    category: "Payments",
    status: "live",
    icon: <CreditCard className="h-5 w-5 text-indigo-600" />,
    iconBg: "bg-indigo-500/10",
  },
  {
    name: "Razorpay",
    description: "Accept UPI, cards, and wallets via Razorpay — built for Indian businesses.",
    category: "Payments",
    status: "live",
    icon: <CreditCard className="h-5 w-5 text-blue-700" />,
    iconBg: "bg-blue-500/10",
  },
  {
    name: "Fal.ai",
    description: "Generate images and short-form videos using FLUX, Kling, Runway, and Stable Diffusion models.",
    category: "AI",
    status: "live",
    icon: <Sparkles className="h-5 w-5 text-pink-600" />,
    iconBg: "bg-pink-500/10",
  },
  {
    name: "Zapier",
    description: "Trigger workflows in 5,000+ apps when leads arrive, campaigns send, or keywords change.",
    category: "Automation",
    status: "coming-soon",
    icon: <Zap className="h-5 w-5 text-orange-500" />,
    iconBg: "bg-orange-500/10",
  },
  {
    name: "Slack",
    description: "Get real-time alerts in Slack for new leads, rank drops, and campaign completions.",
    category: "Automation",
    status: "coming-soon",
    icon: <Globe className="h-5 w-5 text-emerald-600" />,
    iconBg: "bg-emerald-500/10",
  },
  {
    name: "HubSpot CRM",
    description: "Sync leads and contacts bi-directionally with your HubSpot CRM.",
    category: "CRM",
    status: "coming-soon",
    icon: <Globe className="h-5 w-5 text-orange-600" />,
    iconBg: "bg-orange-500/10",
  },
];

const CATEGORIES = ["All", "SEO", "Analytics", "AI", "Email", "Payments", "Automation", "CRM"];

const STATUS_CONFIG = {
  live: { label: "Live", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
  beta: { label: "Beta", className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
  "coming-soon": { label: "Coming Soon", className: "bg-muted text-muted-foreground border-border" },
};

export default function IntegrationsPage() {
  const [, setLocation] = useLocation();
  const { dark, toggle } = useDarkMode();
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = activeCategory === "All"
    ? INTEGRATIONS
    : INTEGRATIONS.filter(i => i.category === activeCategory);

  const liveCount = INTEGRATIONS.filter(i => i.status === "live").length;

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
            <Button variant="ghost" size="sm" onClick={() => setLocation("/report")} className="hidden sm:inline-flex">
              Free SEO Audit
            </Button>
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
      <section className="bg-sidebar text-sidebar-foreground py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary bg-primary/10">
            {liveCount} live integrations
          </Badge>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display mb-4">
            Connect your favourite tools
          </h1>
          <p className="text-sidebar-foreground/70 text-lg max-w-2xl mx-auto">
            SEO Command plugs into the platforms you already use — from Google Search Console to OpenAI to Stripe — so everything works together seamlessly.
          </p>
        </div>
      </section>

      {/* Filter tabs */}
      <section className="border-b bg-background sticky top-14 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-1 py-3 overflow-x-auto scrollbar-none">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations grid */}
      <section className="py-12 sm:py-16 flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(integration => {
              const status = STATUS_CONFIG[integration.status];
              return (
                <div
                  key={integration.name}
                  className={`rounded-xl border bg-card p-5 flex flex-col gap-3 transition-all ${
                    integration.status === "coming-soon"
                      ? "opacity-60"
                      : "hover:border-primary/40 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${integration.iconBg}`}>
                      {integration.icon}
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${status.className}`}>
                      {status.label}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{integration.name}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{integration.description}</p>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-1">
                    <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
                      {integration.category}
                    </span>
                    {integration.status === "live" && (
                      <button
                        onClick={() => setLocation("/settings")}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Configure
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No integrations found for this category.</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 bg-sidebar text-sidebar-foreground">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-bold font-display mb-3">
            Missing an integration?
          </h2>
          <p className="text-sidebar-foreground/70 mb-6">
            We add new integrations every month. Tell us what you need and we'll prioritise it.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={() => setLocation("/login")}>
              Get started free
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <a href="mailto:support@seocommand.in">
              <Button size="lg" variant="outline" className="border-sidebar-foreground/30 text-sidebar-foreground hover:bg-sidebar-foreground/10">
                Request an integration
              </Button>
            </a>
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
            <button onClick={() => setLocation("/pricing")} className="hover:text-foreground transition-colors">Pricing</button>
            <button onClick={() => setLocation("/changelog")} className="hover:text-foreground transition-colors">Changelog</button>
            <button onClick={() => setLocation("/login")} className="hover:text-foreground transition-colors font-medium text-primary">Sign In</button>
          </nav>
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} SEO Command</p>
        </div>
      </footer>
    </div>
  );
}


