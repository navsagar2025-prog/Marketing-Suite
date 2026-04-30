import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle2, ShieldCheck, ArrowRight, Check, X } from "lucide-react";

type Plan = {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  popular: boolean;
  cta: string;
  features: { label: string; included: boolean }[];
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Perfect for freelancers & solo founders",
    monthlyPrice: 999,
    annualPrice: 749,
    popular: false,
    cta: "Get Started",
    features: [
      { label: "1 website", included: true },
      { label: "25 keywords tracked", included: true },
      { label: "1 active campaign", included: true },
      { label: "SEO audits", included: true },
      { label: "Keyword rank tracking", included: true },
      { label: "Lead capture forms", included: true },
      { label: "50 AI generations / month", included: true },
      { label: "Email support", included: true },
      { label: "Backlink tracking", included: false },
      { label: "A/B testing", included: false },
      { label: "Analytics & reports", included: false },
      { label: "White-label reports", included: false },
      { label: "Team members", included: false },
      { label: "API access", included: false },
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For growing businesses that need more",
    monthlyPrice: 2499,
    annualPrice: 1999,
    popular: true,
    cta: "Get Started",
    features: [
      { label: "5 websites", included: true },
      { label: "200 keywords tracked", included: true },
      { label: "Unlimited campaigns", included: true },
      { label: "SEO audits", included: true },
      { label: "Keyword rank tracking", included: true },
      { label: "Lead capture forms", included: true },
      { label: "300 AI generations / month", included: true },
      { label: "Priority support", included: true },
      { label: "Backlink tracking", included: true },
      { label: "A/B testing & UTM builder", included: true },
      { label: "Analytics & reports", included: true },
      { label: "White-label reports", included: false },
      { label: "Team members", included: false },
      { label: "API access", included: false },
    ],
  },
  {
    id: "agency",
    name: "Agency",
    tagline: "For agencies & power users at scale",
    monthlyPrice: 5999,
    annualPrice: 4999,
    popular: false,
    cta: "Get Started",
    features: [
      { label: "Unlimited websites", included: true },
      { label: "Unlimited keywords", included: true },
      { label: "Unlimited campaigns", included: true },
      { label: "SEO audits", included: true },
      { label: "Keyword rank tracking", included: true },
      { label: "Lead capture forms", included: true },
      { label: "1,000 AI generations / month", included: true },
      { label: "Dedicated support", included: true },
      { label: "Backlink tracking", included: true },
      { label: "A/B testing & UTM builder", included: true },
      { label: "Analytics & reports", included: true },
      { label: "White-label reports", included: true },
      { label: "Up to 5 team members", included: true },
      { label: "API access", included: true },
    ],
  },
];

const FAQ = [
  {
    q: "Is there a free trial?",
    a: "Yes — you can run a free SEO audit on any URL without creating an account. When you're ready for keyword tracking, campaigns, and AI tools, pick any plan and start a 7-day free trial. No credit card required.",
  },
  {
    q: "How does annual billing work?",
    a: "Annual plans are billed once per year. You save roughly 25% compared to the month-to-month rate. You can switch between monthly and annual at any time from your settings.",
  },
  {
    q: "Can I cancel at any time?",
    a: "Absolutely. Cancel from your account settings whenever you like. Monthly subscribers are not charged on the next cycle. Annual subscribers retain access until the end of the billing period — no partial refunds.",
  },
  {
    q: "Does pricing include GST?",
    a: "Prices shown are exclusive of GST. 18% GST is added at checkout as applicable under Indian tax law. A GST invoice is automatically issued to your registered email after every payment.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes, upgrade or downgrade any time. Upgrades take effect immediately (prorated). Downgrades take effect at the start of the next billing cycle.",
  },
  {
    q: "Do you offer custom plans for large teams?",
    a: "If you need more than 5 team members, more than 1,000 AI generations, or enterprise-level SLAs, reach out at support@seocommand.in and we'll put together a custom quote.",
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [, setLocation] = useLocation();

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
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
            <Button variant="ghost" size="sm" onClick={() => setLocation("/report")}>
              Free SEO Audit
            </Button>
            <Button size="sm" onClick={() => setLocation("/login")}>
              Sign In
            </Button>
          </nav>
        </div>
      </header>

      <section className="bg-sidebar text-sidebar-foreground py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary bg-primary/10">
            Pricing in Indian Rupees
          </Badge>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-sidebar-foreground/70 text-lg max-w-xl mx-auto mb-2">
            SEMrush charges ₹9,166/mo for less. We start at ₹999.
          </p>
          <p className="text-sidebar-foreground/50 text-sm mb-8">
            All plans include a 7-day free trial. No credit card required.
          </p>

          <div className="inline-flex items-center gap-3 bg-sidebar-foreground/10 rounded-full px-2 py-1.5">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                !annual
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                annual
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
              }`}
            >
              Annual
              <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                SAVE 25%
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan) => {
              const price = annual ? plan.annualPrice : plan.monthlyPrice;
              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col ${
                    plan.popular
                      ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary"
                      : "border-border"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-0 right-0 flex justify-center">
                      <Badge className="bg-primary text-primary-foreground text-xs px-3 py-1">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader className={`pb-4 ${plan.popular ? "pt-8" : "pt-6"}`}>
                    <div className="mb-3">
                      <h3 className="text-xl font-bold font-display">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{plan.tagline}</p>
                    </div>
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-bold font-display">{fmt(price)}</span>
                      <span className="text-muted-foreground text-sm mb-1.5">/mo</span>
                    </div>
                    {annual && (
                      <p className="text-xs text-muted-foreground">
                        Billed annually — {fmt(price * 12)}/year
                      </p>
                    )}
                    {!annual && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Or {fmt(plan.annualPrice)}/mo on annual — save {fmt((plan.monthlyPrice - plan.annualPrice) * 12)}/year
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 gap-5">
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => setLocation("/login")}
                    >
                      {plan.cta}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                    <ul className="space-y-2.5">
                      {plan.features.map((f) => (
                        <li key={f.label} className="flex items-center gap-2.5 text-sm">
                          {f.included ? (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                          )}
                          <span className={f.included ? "text-foreground" : "text-muted-foreground/50"}>
                            {f.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            All prices in INR, exclusive of 18% GST. Annual plans billed as a single payment.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-muted/30 border-t border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-2xl font-bold font-display text-center mb-8">
            How we compare to the competition
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 pr-4 font-semibold w-48">Tool</th>
                  <th className="text-right py-3 px-4 font-semibold">Entry plan</th>
                  <th className="text-right py-3 px-4 font-semibold">Mid plan</th>
                  <th className="text-right py-3 px-4 font-semibold text-primary">All-in-one</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "SEMrush", entry: "₹9,166", mid: "₹18,326", note: "SEO only" },
                  { name: "Ahrefs", entry: "₹8,416", mid: "₹16,581", note: "SEO only" },
                  { name: "Moz Pro", entry: "₹4,831", mid: "₹8,325", note: "SEO only" },
                  { name: "SE Ranking", entry: "₹1,788", mid: "₹3,738", note: "SEO only" },
                  { name: "Ubersuggest", entry: "₹2,491", mid: "₹4,983", note: "Limited AI" },
                ].map((row) => (
                  <tr key={row.name} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium text-muted-foreground">{row.name}</td>
                    <td className="text-right py-3 px-4 text-muted-foreground">{row.entry}</td>
                    <td className="text-right py-3 px-4 text-muted-foreground">{row.mid}</td>
                    <td className="text-right py-3 px-4 text-muted-foreground/60 text-xs">{row.note}</td>
                  </tr>
                ))}
                <tr className="bg-primary/5 border-t-2 border-primary/30">
                  <td className="py-3 pr-4 font-bold text-primary">SEO Command</td>
                  <td className="text-right py-3 px-4 font-bold text-primary">₹999</td>
                  <td className="text-right py-3 px-4 font-bold text-primary">₹2,499</td>
                  <td className="text-right py-3 px-4 text-xs font-semibold text-green-600 dark:text-green-400">
                    SEO + AI + CRM + Campaigns
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-center mb-10">
            Frequently asked questions
          </h2>
          <Accordion type="single" collapsible className="space-y-2">
            {FAQ.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium text-left hover:no-underline py-4">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-4 leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-sidebar text-sidebar-foreground">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-bold font-display mb-3">
            Start free. No credit card needed.
          </h2>
          <p className="text-sidebar-foreground/70 mb-8">
            Every plan includes a 7-day free trial. Cancel anytime.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={() => setLocation("/login")} className="w-full sm:w-auto">
              Start your free trial
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setLocation("/report")}
              className="w-full sm:w-auto border-sidebar-foreground/30 text-sidebar-foreground hover:bg-sidebar-foreground/10"
            >
              Try free SEO audit first
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
            <button onClick={() => setLocation("/report")} className="hover:text-foreground transition-colors">
              Free SEO Audit
            </button>
            <button onClick={() => setLocation("/pricing")} className="hover:text-foreground transition-colors font-medium text-primary">
              Pricing
            </button>
            <button onClick={() => setLocation("/login")} className="hover:text-foreground transition-colors">
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
