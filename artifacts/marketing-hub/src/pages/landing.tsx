import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { HomeSlider } from "@/components/HomeSlider";
import {
  ShieldCheck,
  TrendingUp,
  Sparkles,
  Users,
  MailOpen,
  Link2,
  Share2,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Zap,
  Globe,
  FileText,
  Lock,
} from "lucide-react";

const SERVICES = [
  {
    icon: <ShieldCheck className="h-6 w-6 text-primary" />,
    title: "SEO Auditing",
    description: "Instantly scan any page for on-page issues, score it out of 100, and get prioritised fixes.",
    href: "/report",
    public: true,
  },
  {
    icon: <TrendingUp className="h-6 w-6 text-primary" />,
    title: "Keyword Tracking",
    description: "Monitor rankings for unlimited keywords across multiple sites and get alerted to drops.",
    href: "/keywords",
  },
  {
    icon: <Sparkles className="h-6 w-6 text-primary" />,
    title: "AI Content Generation",
    description: "Generate blog posts, meta descriptions, and social copy with GPT-powered AI tools.",
    href: "/ai",
  },
  {
    icon: <Users className="h-6 w-6 text-primary" />,
    title: "Lead Capture & Forms",
    description: "Build embeddable lead forms, qualify visitors automatically, and manage your pipeline.",
    href: "/leads",
  },
  {
    icon: <MailOpen className="h-6 w-6 text-primary" />,
    title: "Campaign Management",
    description: "Send targeted email campaigns, track opens and clicks, and automate follow-ups.",
    href: "/campaigns",
  },
  {
    icon: <Link2 className="h-6 w-6 text-primary" />,
    title: "Backlink Tracking",
    description: "Discover new backlinks, monitor lost links, and find competitor link-building opportunities.",
    href: "/backlinks",
  },
  {
    icon: <Share2 className="h-6 w-6 text-primary" />,
    title: "Social Scheduling",
    description: "Plan and publish content across social channels from one unified calendar.",
    href: "/social",
  },
  {
    icon: <BarChart3 className="h-6 w-6 text-primary" />,
    title: "Analytics & Reports",
    description: "Unified dashboards combining traffic, rankings, leads, and campaign data in one view.",
    href: "/analytics",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Connect your site",
    description: "Add your website in seconds. We'll start monitoring straight away — no code changes needed.",
  },
  {
    step: "02",
    title: "Track & analyse",
    description: "Get live rankings, audit scores, backlink counts, and lead data updated daily.",
  },
  {
    step: "03",
    title: "Grow with AI",
    description: "Let AI surface opportunities, draft content, qualify leads, and run campaigns automatically.",
  },
];

const HIGHLIGHTS = [
  {
    icon: <Zap className="h-5 w-5 text-primary" />,
    title: "AI-powered",
    description: "Every tool is supercharged with GPT-4 for faster insights and content.",
  },
  {
    icon: <Globe className="h-5 w-5 text-primary" />,
    title: "Multi-site",
    description: "Manage unlimited websites from a single account without switching tabs.",
  },
  {
    icon: <FileText className="h-5 w-5 text-primary" />,
    title: "White-label reports",
    description: "Export branded PDF reports you can share directly with clients.",
  },
  {
    icon: <Lock className="h-5 w-5 text-primary" />,
    title: "Team access",
    description: "Invite team members with role-based permissions to collaborate safely.",
  },
];

const NAV_LINKS = [
  { label: "Free SEO Audit", href: "/report" },
  { label: "Pricing", href: "/pricing" },
  { label: "Sign In", href: "/login" },
];

export default function LandingPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display font-bold text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span>SEO Command</span>
          </div>
          <nav className="flex items-center gap-2">
            {NAV_LINKS.map(link => (
              <Button
                key={link.href}
                variant={link.href === "/login" ? "default" : "ghost"}
                size="sm"
                onClick={() => setLocation(link.href)}
              >
                {link.label}
              </Button>
            ))}
          </nav>
        </div>
      </header>

      <HomeSlider />

      <section className="bg-sidebar text-sidebar-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-1.5 bg-primary/15 text-primary text-sm font-medium rounded-full px-3 py-1 mb-6">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All-in-one platform — no stitching tools together
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display leading-tight mb-6">
            Your All-in-One SEO &amp;<br className="hidden sm:block" /> Marketing Command Center
          </h1>
          <p className="text-sidebar-foreground/70 text-lg sm:text-xl max-w-2xl mx-auto mb-10">
            Audit your site, track keywords, generate AI content, capture leads,
            and run campaigns — all from one powerful dashboard.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => setLocation("/login")}
              className="w-full sm:w-auto"
              data-testid="hero-sign-in"
            >
              Sign In
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setLocation("/report")}
              className="w-full sm:w-auto border-sidebar-foreground/30 text-sidebar-foreground hover:bg-sidebar-foreground/10"
              data-testid="hero-free-audit"
            >
              View Free Audit
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold font-display mb-3">
              Everything you need to grow online
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Eight integrated tools that replace a whole stack of separate subscriptions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SERVICES.map(service => (
              <div
                key={service.title}
                className="group rounded-xl border bg-card p-5 flex flex-col gap-3 hover:border-primary/50 hover:shadow-sm transition-all duration-200 cursor-pointer"
                onClick={() => setLocation(service.public ? (service.href ?? "/login") : "/login")}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  {service.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{service.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{service.description}</p>
                </div>
                {service.public && (
                  <span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5 self-start">
                    Free to try
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 border-b bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold font-display mb-3">How it works</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Go from zero to growing in three simple steps.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
            <div className="hidden sm:block absolute top-8 left-1/6 right-1/6 h-px bg-border" />

            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="flex flex-col items-center text-center relative">
                <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg mb-4 shadow-md z-10">
                  {step.step}
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {HIGHLIGHTS.map(h => (
              <div key={h.title} className="flex flex-col items-center text-center gap-3 p-4 rounded-xl hover:bg-muted/40 transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  {h.icon}
                </div>
                <div>
                  <p className="font-semibold text-sm mb-1">{h.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{h.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 border-b bg-muted/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold font-display mb-2">Trusted by marketers across India</h2>
            <p className="text-muted-foreground text-sm">Real teams. Real results.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                body: "Replaced SEMrush and 3 other tools. Everything I need is in one place — and it actually costs less.",
                name: "Priya Mehta",
                title: "Founder, GrowthCraft",
                initials: "PM",
              },
              {
                body: "The AI content brief alone saves us 4–5 hours a week. The keyword tracker keeps our clients happy and informed.",
                name: "Arjun Sinha",
                title: "SEO Lead, DigitalEdge",
                initials: "AS",
              },
              {
                body: "White-label reports are a game changer. Our clients think we built a custom analytics tool just for them.",
                name: "Sneha Kapoor",
                title: "Agency Owner, Rank Factory",
                initials: "SK",
              },
            ].map((t) => (
              <div key={t.name} className="rounded-xl border bg-card p-6 flex flex-col gap-4">
                <p className="text-sm leading-relaxed text-foreground/80 flex-1">"{t.body}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.title}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-sidebar text-sidebar-foreground">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold font-display mb-4">
            Ready to take control of your SEO?
          </h2>
          <p className="text-sidebar-foreground/70 mb-8">
            Start with a free SEO audit — no account needed.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => setLocation("/login")}
              className="w-full sm:w-auto"
            >
              Sign In
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setLocation("/report")}
              className="w-full sm:w-auto border-sidebar-foreground/30 text-sidebar-foreground hover:bg-sidebar-foreground/10"
            >
              View Free Audit
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-display font-bold text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>SEO Command</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <button
              onClick={() => setLocation("/report")}
              className="hover:text-foreground transition-colors"
            >
              Free SEO Audit
            </button>
            <button
              onClick={() => setLocation("/login")}
              className="hover:text-foreground transition-colors"
            >
              Dashboard
            </button>
            <button
              onClick={() => setLocation("/login")}
              className="hover:text-foreground transition-colors font-medium text-primary"
            >
              Sign In
            </button>
          </nav>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} SEO Command. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
