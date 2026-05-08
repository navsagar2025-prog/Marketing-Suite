import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Eye, X } from "lucide-react";
import { useState } from "react";

export function ImpersonationBanner() {
  const { impersonation, user, stopImpersonation } = useAuth();
  const [stopping, setStopping] = useState(false);

  if (!impersonation || !user) return null;

  return (
    <div
      className="sticky top-0 z-50 w-full bg-amber-500 text-amber-950 border-b border-amber-700 px-4 py-2 flex items-center justify-between gap-3 shadow-sm"
      data-testid="impersonation-banner"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-4 w-4 shrink-0" />
        <p className="text-sm font-medium truncate">
          Impersonating <span className="font-bold">{user.username}</span> as {impersonation.actorUsername}.
          All actions are recorded in the security audit log.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="bg-amber-100 hover:bg-amber-50 border-amber-700 text-amber-950 shrink-0"
        onClick={async () => {
          setStopping(true);
          try { await stopImpersonation(); } finally { setStopping(false); }
        }}
        disabled={stopping}
        data-testid="button-stop-impersonation"
      >
        <X className="h-3.5 w-3.5 mr-1.5" />
        Stop impersonation
      </Button>
    </div>
  );
}
