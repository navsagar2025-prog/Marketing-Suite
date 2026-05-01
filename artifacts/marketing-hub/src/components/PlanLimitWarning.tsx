import { Link } from "wouter";
import { AlertTriangle, Zap } from "lucide-react";
import type { BillingMe } from "@workspace/api-client-react";

interface Props {
  billing: BillingMe | undefined;
  metric: "websites" | "keywords" | "campaigns";
}

const LABELS: Record<Props["metric"], string> = {
  websites: "websites",
  keywords: "keywords",
  campaigns: "campaigns",
};

export default function PlanLimitWarning({ billing, metric }: Props) {
  if (!billing) return null;

  const limit = billing.limits[metric];
  if (limit === -1) return null;

  const used = billing.usage[metric];
  const pct = limit === 0 ? 1 : used / limit;
  if (pct < 0.8) return null;

  const atLimit = used >= limit;
  const label = LABELS[metric];

  return (
    <div
      data-testid={`banner-plan-limit-${metric}`}
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm mb-4 ${atLimit ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-amber-400/40 bg-amber-50/60 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"}`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        {atLimit
          ? `You've reached your limit of ${limit} ${label}.`
          : `You've used ${used} of ${limit} ${label}.`}
        {" "}
        {atLimit ? "Upgrade your plan to add more." : "You're close to your plan limit — upgrade to avoid interruptions."}
      </span>
      <Link href="/pricing">
        <span className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline whitespace-nowrap cursor-pointer">
          <Zap className="h-3.5 w-3.5" />
          Upgrade
        </span>
      </Link>
    </div>
  );
}
