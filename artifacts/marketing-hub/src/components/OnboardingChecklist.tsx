import { useState } from "react";
import { Link } from "wouter";
import {
  CheckCircle2, Circle, X, ChevronDown, ChevronUp, ListChecks, PartyPopper
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useListWebsites,
  useListKeywords,
  useListCampaigns,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

const DISMISSED_KEY = "onboarding_checklist_dismissed";
const COLLAPSED_KEY = "onboarding_checklist_collapsed";
const CUSTOM_CHECKED_PREFIX = "onboarding_custom_checked_";

const BUILT_IN_STEP_IDS = new Set(["add_website", "run_audit", "track_keyword", "create_campaign"]);

interface OnboardingStepConfig {
  id: string;
  label: string;
  href: string;
  enabled: boolean;
  description?: string;
}

const DEFAULT_STEP_CONFIGS: OnboardingStepConfig[] = [
  { id: "add_website", label: "Add your first website", href: "/websites", enabled: true },
  { id: "run_audit", label: "Run a site audit", href: "/websites", enabled: true },
  { id: "track_keyword", label: "Track a keyword", href: "/keywords", enabled: true },
  { id: "create_campaign", label: "Create a campaign", href: "/campaigns", enabled: true },
];

function useOnboardingStepConfigs() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { token } = useAuth();
  return useQuery<OnboardingStepConfig[]>({
    queryKey: ["onboarding-step-configs"],
    queryFn: async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${base}/api/settings/onboarding-steps`, { headers });
        if (!res.ok) return DEFAULT_STEP_CONFIGS;
        return res.json();
      } catch {
        return DEFAULT_STEP_CONFIGS;
      }
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!token,
  });
}

export function useOnboardingChecklist() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "true"
  );
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) === "true"
  );

  // Manual checked state for custom steps (persisted in localStorage)
  const [customChecked, setCustomChecked] = useState<Record<string, boolean>>(() => {
    const result: Record<string, boolean> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CUSTOM_CHECKED_PREFIX)) {
        const id = key.slice(CUSTOM_CHECKED_PREFIX.length);
        result[id] = localStorage.getItem(key) === "true";
      }
    }
    return result;
  });

  const { data: websites, isLoading: websitesLoading } = useListWebsites();
  const { data: keywords, isLoading: keywordsLoading } = useListKeywords();
  const { data: campaigns, isLoading: campaignsLoading } = useListCampaigns();
  const { data: stepConfigs, isLoading: configLoading } = useOnboardingStepConfigs();

  const isLoading = websitesLoading || keywordsLoading || campaignsLoading || configLoading;

  const hasWebsite = (websites ?? []).length > 0;
  const hasAudit = (websites ?? []).some(
    (w) => w.seoScore !== null && w.seoScore !== undefined
  );
  const hasKeyword = (keywords ?? []).length > 0;
  const hasCampaign = (campaigns ?? []).length > 0;

  const builtInDone: Record<string, boolean> = {
    add_website: hasWebsite,
    run_audit: hasAudit,
    track_keyword: hasKeyword,
    create_campaign: hasCampaign,
  };

  const descriptionByStepId: Record<string, string> = {
    add_website: "Connect a website so we can track its SEO health.",
    run_audit: 'Open your website and click "Run Audit" to get an SEO score.',
    track_keyword: "Add keywords to monitor your search rankings over time.",
    create_campaign: "Set up an email or marketing campaign to reach your audience.",
  };

  const ctaByStepId: Record<string, string> = {
    add_website: "Add Website",
    run_audit: "Go to Websites",
    track_keyword: "Add Keyword",
    create_campaign: "New Campaign",
  };

  const configs = stepConfigs ?? DEFAULT_STEP_CONFIGS;
  const steps = configs
    .filter((cfg) => cfg.enabled)
    .map((cfg) => {
      const isCustom = !BUILT_IN_STEP_IDS.has(cfg.id);
      const done = isCustom ? (customChecked[cfg.id] ?? false) : (builtInDone[cfg.id] ?? false);
      return {
        id: cfg.id,
        done,
        label: cfg.label,
        description: cfg.description ?? descriptionByStepId[cfg.id] ?? "",
        href: cfg.href,
        cta: ctaByStepId[cfg.id] ?? "Go →",
        isCustom,
      };
    });

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = steps.length > 0 && completedCount === steps.length;

  function toggleCustomStep(id: string) {
    const next = !(customChecked[id] ?? false);
    localStorage.setItem(`${CUSTOM_CHECKED_PREFIX}${id}`, String(next));
    setCustomChecked(prev => ({ ...prev, [id]: next }));
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }

  function toggleCollapsed() {
    const next = !collapsed;
    localStorage.setItem(COLLAPSED_KEY, String(next));
    setCollapsed(next);
  }

  return {
    dismissed,
    collapsed,
    isLoading,
    steps,
    completedCount,
    allDone,
    dismiss,
    toggleCollapsed,
    toggleCustomStep,
  };
}

export function OnboardingDashboardCard() {
  const {
    dismissed,
    collapsed,
    isLoading,
    steps,
    completedCount,
    allDone,
    dismiss,
    toggleCollapsed,
    toggleCustomStep,
  } = useOnboardingChecklist();

  if (dismissed || steps.length === 0) return null;

  return (
    <Card
      className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent"
      data-testid="onboarding-checklist"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <button
            data-testid="checklist-toggle"
            className="flex-1 flex items-center gap-2 text-left group"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-controls="onboarding-steps"
          >
            <ListChecks className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base">Getting Started</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isLoading
                  ? "Loading your workspace..."
                  : allDone
                  ? "All steps complete — you're all set!"
                  : `${completedCount} of ${steps.length} steps complete`}
              </p>
            </div>
            {collapsed ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            )}
          </button>
          {allDone && (
            <button
              aria-label="Dismiss getting started checklist"
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground mt-0.5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{
              width: isLoading || steps.length === 0
                ? "0%"
                : `${(completedCount / steps.length) * 100}%`,
            }}
          />
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="pt-0 space-y-1" id="onboarding-steps" data-testid="checklist-body">
          {allDone ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <PartyPopper className="h-8 w-8 text-primary" />
              <p className="font-semibold text-sm">You're all set!</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                You've completed every setup step. Your workspace is ready to go.
              </p>
              <Button size="sm" variant="outline" className="mt-1 text-xs" onClick={dismiss}>
                Dismiss checklist
              </Button>
            </div>
          ) : (
            steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                  step.done ? "opacity-50" : ""
                }`}
              >
                {step.done ? (
                  <CheckCircle2
                    className={`h-4 w-4 text-primary shrink-0 ${step.isCustom ? "cursor-pointer" : ""}`}
                    onClick={step.isCustom ? () => toggleCustomStep(step.id) : undefined}
                  />
                ) : step.isCustom ? (
                  <button
                    aria-label={`Mark "${step.label}" as done`}
                    onClick={() => toggleCustomStep(step.id)}
                    className="h-4 w-4 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    title="Click to mark as done"
                  >
                    <Circle className="h-4 w-4" />
                  </button>
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium leading-tight ${
                      step.done ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {step.label}
                  </p>
                  {!step.done && step.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {step.description}
                    </p>
                  )}
                </div>
                {!step.done && (
                  step.isCustom ? (
                    <a href={step.href} target={step.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="text-xs h-7 shrink-0">
                        {step.cta}
                      </Button>
                    </a>
                  ) : (
                    <Link href={step.href}>
                      <Button size="sm" variant="outline" className="text-xs h-7 shrink-0">
                        {step.cta}
                      </Button>
                    </Link>
                  )
                )}
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function OnboardingFloatWidget() {
  const [open, setOpen] = useState(false);
  const {
    dismissed,
    isLoading,
    steps,
    completedCount,
    allDone,
    dismiss,
    toggleCustomStep,
  } = useOnboardingChecklist();

  if (dismissed || steps.length === 0) return null;

  const pct = isLoading ? 0 : (completedCount / steps.length) * 100;
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2"
      data-testid="onboarding-float"
    >
      {open && (
        <div className="w-72 rounded-xl border border-border bg-card shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-border">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Getting Started</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close checklist"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-4 pt-2 pb-1">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {isLoading
                ? "Loading..."
                : allDone
                ? "All done!"
                : `${completedCount} of ${steps.length} steps complete`}
            </p>
          </div>

          <div className="px-2 pb-3 space-y-0.5">
            {allDone ? (
              <div className="flex flex-col items-center gap-2 py-3 text-center px-2">
                <PartyPopper className="h-7 w-7 text-primary" />
                <p className="font-semibold text-sm">You're all set!</p>
                <p className="text-xs text-muted-foreground">
                  Your workspace is fully configured.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1 text-xs"
                  onClick={dismiss}
                >
                  Dismiss
                </Button>
              </div>
            ) : (
              steps.map((step) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-2 ${
                    step.done ? "opacity-50" : "hover:bg-muted/50"
                  } transition-colors`}
                >
                  {step.done ? (
                    <CheckCircle2
                      className={`h-3.5 w-3.5 text-primary shrink-0 ${step.isCustom ? "cursor-pointer" : ""}`}
                      onClick={step.isCustom ? () => toggleCustomStep(step.id) : undefined}
                    />
                  ) : step.isCustom ? (
                    <button
                      aria-label={`Mark "${step.label}" as done`}
                      onClick={() => toggleCustomStep(step.id)}
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      title="Click to mark as done"
                    >
                      <Circle className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-medium ${
                        step.done ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                  {!step.done && (
                    step.isCustom ? (
                      <a href={step.href} target={step.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" onClick={() => setOpen(false)}>
                        <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-primary hover:text-primary shrink-0">
                          Go →
                        </Button>
                      </a>
                    ) : (
                      <Link href={step.href} onClick={() => setOpen(false)}>
                        <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-primary hover:text-primary shrink-0">
                          Go →
                        </Button>
                      </Link>
                    )
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Setup checklist — ${completedCount} of ${steps.length} steps done`}
        className="relative flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
      >
        <svg
          className="absolute inset-0 w-full h-full -rotate-90"
          viewBox="0 0 28 28"
        >
          <circle
            cx="14"
            cy="14"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="2.5"
          />
          <circle
            cx="14"
            cy="14"
            r={radius}
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <ListChecks className="h-5 w-5 relative z-10" />
        {completedCount < steps.length && !isLoading && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-background">
            {steps.length - completedCount}
          </span>
        )}
      </button>
    </div>
  );
}
