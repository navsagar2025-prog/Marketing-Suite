import { useState } from "react";
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
  Star,
  ChevronDown,
  ChevronUp,
  Search,
  MapPin,
  FlaskConical,
  FileBarChart,
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
    description: "Monitor rankings for up to 200 keywords across multiple sites and get alerted to drops.",
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

const STATS = [
  { value: "500+", label: "Websites Audited" },
  { value: "50,000+", label: "Keywords Tracked" },
  { value: "12,000+", label: "Leads Captured" },
  { value: "98%", label: "Customer Satisfaction" },
];

const TESTIMONIALS = [
  {
    body: "Replaced SEMrush and 3 other tools. Everything I need is in one place — and it actually costs less.",
    name: "Priya Mehta",
    title: "Founder, GrowthCraft",
    initials: "PM",
    rating: 5,
  },
  {
    body: "The AI content brief alone saves us 4–5 hours a week. The keyword tracker keeps our clients happy and informed.",
    name: "Arjun Sinha",
    title: "SEO Lead, DigitalEdge",
    initials: "AS",
    rating: 5,
  },
  {
    body: "White-label reports are a game changer. Our clients think we built a custom analytics tool just for them.",
    name: "Sneha Kapoor",
    title: "Agency Owner, Rank Factory",
    initials: "SK",
    rating: 5,
  },
];

const FAQ_ITEMS = [
  {
    q: "Is there a free trial?",
    a: "Yes — start with a 14-day free trial on any paid plan. No credit card required to begin. You also get a free SEO audit on any URL without even creating an account.",
  },
  {
    q: "What happens after the trial?",
    a: "At the end of your 14-day trial, you'll be prompted to add a payment method to continue. If you don't, your account is paused — no surprise charges.",
  },
  {
    q: "How does annual billing work?",
    a: "Annual plans are billed once per year. You save roughly 25% compared to month-to-month. You can switch between billing cycles at any time from your settings.",
  },
  {
    q: "Can I cancel at any time?",
    a: "Absolutely. Cancel from your account settings whenever you like. No long-term contracts, no cancellation fees.",
  },
  {
    q: "What is 'Bring Your Own AI Key'?",
    a: "On Growth and Agency plans you can connect your own OpenAI, Anthropic, or Gemini API key. Your AI calls route through your key, giving you unlimited generations at cost — no monthly AI cap applies.",
  },
  {
    q: "Do you offer custom plans for large teams?",
    a: "If you need more than 5 team members or enterprise-level SLAs, contact us at support@seocommand.in and we'll put together a custom quote.",
  },
];

const NAV_LINKS = [
  { label: "Free SEO Audit", href: "/report" },
  { label: "Pricing", href: "/pricing" },
  { label: "Sign In", href: "/login" },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium hover:bg-muted/40 transition-colors gap-3"
        onClick={() => setOpen(!open)}
      >
        <span>{q}</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t bg-muted/20">
          <p className="pt-3">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Header ── */}
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

      {/* ── Home Slider ── */}
      <HomeSlider />

      {/* ── Hero ── */}
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-1.5 bg-primary/15 text-primary text-sm font-medium rounded-full px-3 py-1 mb-6">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All-in-one platform — no stitching tools together
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display leading-tight mb-6">
            Your All-in-One SEO &amp;<br className="hidden sm:block" /> Marketing Command Center
          </h1>
          <p className="text-sidebar-foreground/70 text-lg sm:text-xl max-w-2xl mx-auto mb-4">
            Audit your site, track keywords, generate AI content, capture leads,
            and run campaigns — all from one powerful dashboard.
          </p>
          <p className="text-sm text-primary font-medium mb-8">
            14-day free trial &bull; No credit card required
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => setLocation("/login")}
              className="w-full sm:w-auto"
              data-testid="hero-sign-in"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setLocation("/report")}
              className="w-full sm:w-auto border-sidebar-foreground/30 text-sidebar-foreground hover:bg-sidebar-foreground/10"
              data-testid="hero-free-audit"
            >
              View Free SEO Audit
            </Button>
          </div>
        </div>
      </section>

      {/* ── Social proof stats ── */}
      <section className="border-b bg-muted/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {STATS.map(stat => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold font-display text-primary">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features / Services ── */}
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
                className="group rounded-xl border bg-card p-5 flex flex-col gap-3 hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer"
                onClick={() => setLocation(service.public ? (service.href ?? "/login") : "/login")}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
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

      {/* ── Dashboard preview mockup ── */}
      <section className="py-16 sm:py-20 border-b bg-muted/20 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold font-display mb-3">
              A complete command center at a glance
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              One unified dashboard gives you your entire digital presence — live.
            </p>
          </div>
          <div className="rounded-2xl border bg-card shadow-xl overflow-hidden">
            {/* Mock top bar */}
            <div className="bg-sidebar px-4 py-3 flex items-center gap-3 border-b border-sidebar-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/60" />
                <div className="w-3 h-3 rounded-full bg-amber-400/60" />
                <div className="w-3 h-3 rounded-full bg-green-400/60" />
              </div>
              <div className="flex-1 bg-sidebar-accent/40 rounded-md h-5 max-w-xs mx-auto" />
            </div>
            {/* Mock layout */}
            <div className="flex" style={{ height: 340 }}>
              {/* Mock sidebar */}
              <div className="w-44 bg-sidebar border-r border-sidebar-border p-3 flex flex-col gap-1 shrink-0">
                {[
                  { icon: <BarChart3 className="h-3.5 w-3.5" />, label: "Dashboard", active: true },
                  { icon: <Globe className="h-3.5 w-3.5" />, label: "Websites" },
                  { icon: <Search className="h-3.5 w-3.5" />, label: "Keywords" },
                  { icon: <Share2 className="h-3.5 w-3.5" />, label: "Social Media" },
                  { icon: <Users className="h-3.5 w-3.5" />, label: "Leads" },
                  { icon: <Sparkles className="h-3.5 w-3.5" />, label: "AI Tools" },
                  { icon: <MapPin className="h-3.5 w-3.5" />, label: "Local SEO" },
                  { icon: <FlaskConical className="h-3.5 w-3.5" />, label: "A/B Tests" },
                ].map(item => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${
                      item.active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/60"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
              {/* Mock content */}
              <div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Websites", value: "12", color: "border-l-blue-500" },
                    { label: "Keywords", value: "148", color: "border-l-violet-500" },
                    { label: "Leads", value: "2,341", color: "border-l-emerald-500" },
                    { label: "Avg SEO Score", value: "74", color: "border-l-orange-500" },
                  ].map(card => (
                    <div key={card.label} className={`rounded-lg border bg-background p-3 border-l-4 ${card.color}`}>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{card.label}</p>
                      <p className="text-xl font-bold font-display">{card.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 flex-1">
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs font-medium mb-2">SEO Score by Website</p>
                    <div className="space-y-1.5">
                      {[
                        { name: "acme.com", score: 87, color: "bg-green-400" },
                        { name: "shop.io", score: 72, color: "bg-blue-400" },
                        { name: "blog.co", score: 54, color: "bg-amber-400" },
                        { name: "store.in", score: 38, color: "bg-red-400" },
                      ].map(item => (
                        <div key={item.name} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-14 truncate">{item.name}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.score}%` }} />
                          </div>
                          <span className="text-[10px] font-medium w-6 text-right">{item.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs font-medium mb-2">Lead Funnel</p>
                    <div className="space-y-1.5">
                      {[
                        { label: "New", value: 340, pct: 100, color: "bg-blue-400" },
                        { label: "Contacted", value: 198, pct: 58, color: "bg-violet-400" },
                        { label: "Qualified", value: 124, pct: 36, color: "bg-amber-400" },
                        { label: "Converted", value: 67, pct: 20, color: "bg-green-400" },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-14">{item.label}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                          </div>
                          <span className="text-[10px] font-medium w-6 text-right">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-16 sm:py-20 border-b">
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

      {/* ── Highlights / Why us ── */}
      <section className="py-12 sm:py-16 border-b bg-muted/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold font-display mb-2">Built for serious marketers</h2>
          </div>
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

      {/* ── Testimonials ── */}
      <section className="py-14 sm:py-20 border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold font-display mb-2">Trusted by marketers across India</h2>
            <p className="text-muted-foreground text-sm">Real teams. Real results.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-xl border bg-card p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
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

      {/* ── FAQ ── */}
      <section className="py-14 sm:py-20 border-b bg-muted/20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold font-display mb-2">Frequently asked questions</h2>
          </div>
          <div className="space-y-2">
            {FAQ_ITEMS.map(item => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-20 bg-sidebar text-sidebar-foreground">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold font-display mb-4">
            Ready to take control of your SEO?
          </h2>
          <p className="text-sidebar-foreground/70 mb-2">
            Start with a 14-day free trial — no credit card required.
          </p>
          <p className="text-xs text-sidebar-foreground/50 mb-8">
            Or try a free SEO audit on any URL, no account needed.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => setLocation("/login")}
              className="w-full sm:w-auto"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setLocation("/report")}
              className="w-full sm:w-auto border-sidebar-foreground/30 text-sidebar-foreground hover:bg-sidebar-foreground/10"
            >
              Free SEO Audit
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-display font-bold text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>SEO Command</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <button onClick={() => setLocation("/report")} className="hover:text-foreground transition-colors">
              Free SEO Audit
            </button>
            <button onClick={() => setLocation("/pricing")} className="hover:text-foreground transition-colors">
              Pricing
            </button>
            <button onClick={() => setLocation("/kb")} className="hover:text-foreground transition-colors">
              Help
            </button>
            <button onClick={() => setLocation("/login")} className="hover:text-foreground transition-colors font-medium text-primary">
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
