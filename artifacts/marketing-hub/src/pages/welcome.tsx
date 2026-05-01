import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

async function persistPlan(plan: string): Promise<boolean> {
  const token = localStorage.getItem("auth_token");
  if (!token) return false;
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/auth/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const PLAN_META: Record<string, { label: string }> = {
  starter: { label: "Starter" },
  growth: { label: "Growth" },
  agency: { label: "Agency" },
};

const REDIRECT_MS = 8000;

export default function WelcomePage() {
  const [plan] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("plan")?.toLowerCase() ?? null;
    return p && p in PLAN_META ? p : null;
  });

  const [persisted, setPersisted] = useState<boolean | null>(null);

  const meta = plan ? PLAN_META[plan] : null;

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const dest = base || "/";

    if (!plan || !meta) {
      window.location.href = dest;
      return;
    }

    let redirectTimer: ReturnType<typeof setTimeout>;

    persistPlan(plan).then((ok) => {
      setPersisted(ok);
      if (!ok) {
        window.location.href = dest;
        return;
      }
      redirectTimer = setTimeout(() => {
        window.location.href = dest;
      }, REDIRECT_MS);
    });

    return () => clearTimeout(redirectTimer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!meta || persisted === false) return null;

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background p-4"
      data-testid="plan-confirmation"
      id="plan-confirmation"
    >
      <div className="flex flex-col items-center gap-5 text-center max-w-sm">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-display mb-1" data-testid="plan-confirmation-heading">
            You're starting on the {meta.label} plan
          </h2>
          <p className="text-muted-foreground text-sm">Your 7-day free trial begins now.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Taking you to your dashboard…
        </div>
      </div>
    </div>
  );
}
