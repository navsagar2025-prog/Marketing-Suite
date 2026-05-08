import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Monitor, Trash2, ShieldAlert, Loader2 } from "lucide-react";

const TOKEN_KEY = "auth_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ""}` });

interface SessionRow {
  id: number;
  jti: string;
  device: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

function fmt(date: string): string {
  const d = new Date(date);
  return d.toLocaleString();
}

export function SessionsCard() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/sessions`, { headers: authHeader() });
      if (!r.ok) throw new Error("Failed to load sessions");
      return r.json() as Promise<SessionRow[]>;
    },
  });

  const revokeOne = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE}/api/sessions/${id}`, { method: "DELETE", headers: authHeader() });
      if (!r.ok) throw new Error("Revoke failed");
    },
    onSuccess: () => {
      toast({ title: "Session revoked" });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: () => toast({ title: "Could not revoke session", variant: "destructive" }),
  });

  const revokeAll = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/sessions/revoke-all`, { method: "POST", headers: authHeader() });
      if (!r.ok) throw new Error("Revoke all failed");
      return (await r.json()) as { revokedCount: number };
    },
    onSuccess: (d) => {
      toast({ title: `Revoked ${d.revokedCount} other session(s)` });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: () => toast({ title: "Could not revoke sessions", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-muted"><Monitor className="h-4 w-4" /></div>
            <div>
              <CardTitle className="text-base">Active Sessions</CardTitle>
              <CardDescription className="mt-0.5">Devices currently signed in to your account.</CardDescription>
            </div>
          </div>
          {sessions && sessions.some(s => !s.current) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => revokeAll.mutate()}
              disabled={revokeAll.isPending}
              data-testid="button-revoke-all-sessions"
            >
              <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
              Sign out other sessions
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !sessions?.length ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <div className="space-y-2" data-testid="sessions-list">
            {sessions.map(s => (
              <div key={s.id} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{s.device ?? "Unknown device"}</p>
                    {s.current && <Badge variant="secondary" className="text-xs">This device</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {s.ip ?? "unknown ip"} · last seen {fmt(s.lastSeenAt)}
                  </p>
                  {s.userAgent && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{s.userAgent}</p>
                  )}
                </div>
                {!s.current && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => revokeOne.mutate(s.id)}
                    disabled={revokeOne.isPending}
                    data-testid={`button-revoke-session-${s.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
