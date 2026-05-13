import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle2, ShieldCheck, ArrowRight, Check, X, Tag, Loader2, Moon, Sun } from "lucide-react";
import { useDarkMode } from "@/lib/useDarkMode";

type Plan = {
  id: string;
  name: string;
  tagline: string;
  monthlyPriceINR: number;
  annualPriceINR: number;
  monthlyPriceUSD: number;
  annualPriceUSD: number;
  popular: boolean;
  cta: string;
  features: { label: string; included: boolean }[];
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Perfect for freelancers & solo founders",
    monthlyPriceINR: 5999,
    annualPriceINR: 4499,
    monthlyPriceUSD: 69,
    annualPriceUSD: 52,
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
      { label: "Bring your own AI key", included: false },
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For growing businesses that need more",
    monthlyPriceINR: 8999,
    annualPriceINR: 6749,
    monthlyPriceUSD: 99,
    annualPriceUSD: 74,
    popular: true,
    cta: "Get Started",
    features: [
      { label: "3 websites", included: true },
      { label: "75 keywords tracked", included: true },
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
      { label: "Bring your own AI key", included: true },
    ],
  },
  {
    id: "agency",
    name: "Agency",
    tagline: "For agencies & power users at scale",
    monthlyPriceINR: 15999,
    annualPriceINR: 11999,
    monthlyPriceUSD: 179,
    annualPriceUSD: 134,
    popular: false,
    cta: "Get Started",
    features: [
      { label: "Unlimited websites", included: true },
      { label: "200 keywords tracked / site", included: true },
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
      { label: "Bring your own AI key", included: true },
    ],
  },
];

const FAQ = [
  {
    q: "Is there a free trial?",
    a: "Yes — you can run a free SEO audit on any URL without creating an account. When you're ready for keyword tracking, campaigns, and AI tools, pick any plan and start a 14-day free trial. No credit card required.",
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
    a: "INR prices shown are exclusive of GST. 18% GST is added at checkout as applicable under Indian tax law. A GST invoice is automatically issued to your registered email after every payment.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes, upgrade or downgrade any time. Upgrades take effect immediately (prorated). Downgrades take effect at the start of the next billing cycle.",
  },
  {
    q: "Do you offer custom plans for large teams?",
    a: "If you need more than 5 team members, more than 1,000 AI generations, or enterprise-level SLAs, reach out at support@seocommand.in and we'll put together a custom quote.",
  },
  {
    q: "What is 'Bring Your Own AI Key'?",
    a: "On Growth and Agency plans you can connect your own OpenAI, Anthropic, or Gemini API key. Your AI calls route through your key, giving you unlimited AI generations at cost — no monthly AI cap applies.",
  },
  {
    q: "Do you offer coupon codes or discounts?",
    a: "Yes! Enter a coupon code at checkout to instantly apply your discount. Codes can be plan-specific or apply across all plans.",
  },
];

type CouponResult = {
  valid: boolean;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  appliesTo: string;
};

function navigateToLogin(plan?: string, coupon?: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const params = new URLSearchParams();
  if (plan) params.set("plan", plan);
  if (coupon) params.set("coupon", coupon);
  const qs = params.toString();
  window.location.href = `${base}/login${qs ? `?${qs}` : ""}`;
}

function applyDiscount(price: number, coupon: CouponResult | null): number {
  if (!coupon) return price;
  if (coupon.discountType === "percent") return Math.round(price * (1 - coupon.discountValue / 100));
  return Math.max(0, price - coupon.discountValue);
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [, setLocation] = useLocation();
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const { dark, toggle } = useDarkMode();

  const fmtINR = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  const fmtUSD = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  const fmt = (plan: Plan) => {
    const raw = annual
      ? (currency === "INR" ? plan.annualPriceINR : plan.annualPriceUSD)
      : (currency === "INR" ? plan.monthlyPriceINR : plan.monthlyPriceUSD);
    return currency === "INR" ? fmtINR(raw) : fmtUSD(raw);
  };

  const basePrice = (plan: Plan) =>
    annual
      ? (currency === "INR" ? plan.annualPriceINR : plan.annualPriceUSD)
      : (currency === "INR" ? plan.monthlyPriceINR : plan.monthlyPriceUSD);

  const savingsPerYear = (plan: Plan) => {
    if (currency === "INR") return (plan.monthlyPriceINR - plan.annualPriceINR) * 12;
    return (plan.monthlyPriceUSD - plan.annualPriceUSD) * 12;
  };

  const annualTotal = (plan: Plan) => {
    const monthly = currency === "INR" ? plan.annualPriceINR : plan.annualPriceUSD;
    return currency === "INR" ? fmtINR(monthly * 12) : fmtUSD(monthly * 12);
  };

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError("");
    setCouponResult(null);
    setCouponLoading(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/billing/validate-coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponError(data.error ?? "Invalid coupon code");
      } else {
        setCouponResult(data as CouponResult);
      }
    } catch {
      setCouponError("Could not validate coupon. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setCouponResult(null);
    setCouponCode("");
    setCouponError("");
  };

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
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button size="sm" onClick={() => setLocation("/login")}>
              Sign In
            </Button>
          </nav>
        </div>
      </header>

      <section className="bg-sidebar text-sidebar-foreground py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-sidebar-foreground/70 text-lg max-w-xl mx-auto mb-2">
            All-in-one SEO + AI + CRM — one platform, one price.
          </p>
          <p className="text-sidebar-foreground/50 text-sm mb-8">
            All plans include a 14-day free trial. No credit card required.
          </p>

          {/* Billing cycle toggle */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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

            {/* Currency toggle */}
            <div className="inline-flex items-center gap-1 bg-sidebar-foreground/10 rounded-full px-1.5 py-1.5">
              <button
                onClick={() => setCurrency("INR")}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  currency === "INR"
                    ? "bg-sidebar-foreground/20 text-sidebar-foreground"
                    : "text-sidebar-foreground/50 hover:text-sidebar-foreground/70"
                }`}
              >
                ₹ INR
              </button>
              <button
                onClick={() => setCurrency("USD")}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  currency === "USD"
                    ? "bg-sidebar-foreground/20 text-sidebar-foreground"
                    : "text-sidebar-foreground/50 hover:text-sidebar-foreground/70"
                }`}
              >
                $ USD
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">

          {/* Coupon code input */}
          <div className="max-w-md mx-auto mb-10">
            {couponResult ? (
              <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3">
                <Tag className="h-4 w-4 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                    Coupon applied: <span className="font-mono">{couponResult.code}</span>
                  </p>
                  <p className="text-xs text-green-600/80 dark:text-green-500/80">
                    {couponResult.discountType === "percent"
                      ? `${couponResult.discountValue}% off`
                      : `${currency === "INR" ? "₹" : "$"}${couponResult.discountValue / 100} off`}
                    {couponResult.appliesTo !== "all" ? ` on ${couponResult.appliesTo} plan` : " on all plans"}
                  </p>
                </div>
                <button
                  onClick={removeCoupon}
                  className="text-xs text-green-600 dark:text-green-400 hover:underline shrink-0"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <Input
                    placeholder="Have a coupon code?"
                    value={couponCode}
                    onChange={e => { setCouponCode(e.target.value); setCouponError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleValidateCoupon()}
                    className="font-mono uppercase text-sm"
                  />
                  <Button
                    variant="outline"
                    size="default"
                    onClick={handleValidateCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    className="shrink-0"
                  >
                    {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </Button>
                </div>
                {couponError && <p className="text-xs text-destructive">{couponError}</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan) => {
              const bp = basePrice(plan);
              const couponApplies = !couponResult || couponResult.appliesTo === "all" || couponResult.appliesTo === plan.id;
              const price = couponApplies ? applyDiscount(bp, couponResult) : bp;
              const hasDiscount = couponApplies && couponResult !== null;
              const fmtPrice = (n: number) => currency === "INR" ? fmtINR(n) : fmtUSD(n);
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
                      {hasDiscount && (
                        <span className="text-xl font-medium text-muted-foreground/50 line-through mr-1">
                          {fmtPrice(bp)}
                        </span>
                      )}
                      <span className="text-4xl font-bold font-display">{fmtPrice(price)}</span>
                      <span className="text-muted-foreground text-sm mb-1.5">/mo</span>
                    </div>
                    {hasDiscount && (
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Coupon applied — saving {fmtPrice(bp - price)}/mo
                      </p>
                    )}
                    {annual && !hasDiscount && (
                      <p className="text-xs text-muted-foreground">
                        Billed annually — {annualTotal(plan)}/year
                      </p>
                    )}
                    {!annual && !hasDiscount && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Or save {fmtPrice(savingsPerYear(plan))}/year on annual
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-0.5">
                        14-day free trial — no credit card required
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 gap-5">
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => navigateToLogin(plan.id, couponResult?.code)}
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
            {currency === "INR"
              ? "All prices in INR, exclusive of 18% GST. Annual plans billed as a single payment."
              : "All prices in USD. Annual plans billed as a single payment. Taxes may apply."}
          </p>
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
            Every plan includes a 14-day free trial. Cancel anytime.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={() => navigateToLogin("growth", couponResult?.code)} className="w-full sm:w-auto">
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

      <footer className="border-t py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 font-display font-bold text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>SEO Command</span>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <button onClick={() => setLocation("/report")} className="hover:text-foreground transition-colors">
                Free SEO Audit
              </button>
              <button onClick={() => setLocation("/integrations")} className="hover:text-foreground transition-colors">
                Integrations
              </button>
              <button onClick={() => setLocation("/changelog")} className="hover:text-foreground transition-colors">
                Changelog
              </button>
              <button onClick={() => setLocation("/pricing")} className="hover:text-foreground transition-colors font-medium text-primary">
                Pricing
              </button>
              <button onClick={() => setLocation("/login")} className="hover:text-foreground transition-colors">
                Sign In
              </button>
            </nav>
          </div>
          <div className="border-t pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} SEO Command. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <a href="mailto:support@seocommand.in" className="hover:text-foreground transition-colors">Contact</a>
              <button onClick={() => setLocation("/privacy")} className="hover:text-foreground transition-colors">Privacy</button>
              <button onClick={() => setLocation("/terms")} className="hover:text-foreground transition-colors">Terms</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
