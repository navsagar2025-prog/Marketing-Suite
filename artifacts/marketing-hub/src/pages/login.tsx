import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";

const PLAN_META: Record<string, { label: string }> = {
  starter: { label: "Starter" },
  growth: { label: "Growth" },
  agency: { label: "Agency" },
};

function getPlanFromSearch(): string | null {
  const params = new URLSearchParams(window.location.search);
  const plan = params.get("plan")?.toLowerCase() ?? null;
  if (plan && plan in PLAN_META) return plan;
  return null;
}

function getResetSuccessFromSearch(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("reset") === "1";
}

export default function LoginPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [resetSuccess] = useState(() => getResetSuccessFromSearch());

  useEffect(() => {
    setSelectedPlan(getPlanFromSearch());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, plan: selectedPlan ?? undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Login failed");
        return;
      }

      const { token, user, planSelected, canSetPlan } = await res.json();

      login(token, user);

      if (planSelected && canSetPlan) {
        const base = import.meta.env.BASE_URL.replace(/\/$/, "");
        window.location.href = `${base}/welcome?plan=${planSelected}`;
      } else {
        setLocation("/");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-display">SEO Command</CardTitle>
          <CardDescription>Sign in to access the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {resetSuccess && (
            <div
              className="mb-4 flex items-center gap-2.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5"
              data-testid="reset-success-banner"
            >
              <p className="text-sm text-green-700 dark:text-green-400">
                Your password has been reset. Sign in with your new password.
              </p>
            </div>
          )}
          {selectedPlan && (
            <div
              className="mb-4 flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5"
              data-testid="plan-banner"
            >
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <p className="text-sm text-foreground">
                You selected the{" "}
                <span className="font-semibold text-primary">{PLAN_META[selectedPlan].label}</span> plan —
                sign in to activate your free trial.
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                data-testid="input-username"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password">
                  <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline-offset-4 hover:underline" data-testid="link-forgot-password">
                    Forgot password?
                  </span>
                </Link>
              </div>
              <Input
                id="password"
                data-testid="input-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" data-testid="text-login-error">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              data-testid="button-login"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…</>
              ) : selectedPlan ? (
                `Sign in & start ${PLAN_META[selectedPlan].label} trial`
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
