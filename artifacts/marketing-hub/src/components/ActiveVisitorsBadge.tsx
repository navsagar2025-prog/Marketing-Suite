import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

export function ActiveVisitorsBadge(): JSX.Element | null {
  const { token, user } = useAuth();
  const { data } = useQuery<{ activeVisitors: number }>({
    queryKey: ["admin-active-visitors"],
    enabled: user?.role === "admin",
    refetchInterval: 10_000,
    queryFn: async () => {
      const r = await fetch(`${apiBase}/api/admin/active-visitors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  if (user?.role !== "admin") return null;
  const count = data?.activeVisitors ?? 0;

  return (
    <Badge
      variant="outline"
      data-testid="badge-active-visitors"
      className="gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <Activity className="h-3 w-3" />
      Active visitors: <span className="font-semibold">{count}</span>
    </Badge>
  );
}
