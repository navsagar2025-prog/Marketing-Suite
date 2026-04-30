import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, ShieldCheck, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportContent } from "./report-detail";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SharedReportPage({ token }: { token: string }) {
  const { data: report, isLoading, error } = useQuery({
    queryKey: ["shared-report", token],
    queryFn: async () => {
      const res = await fetch(`${BASE}/public/report/${token}`);
      if (!res.ok) throw new Error("Report not found");
      return res.json();
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <div className="bg-sidebar text-sidebar-foreground border-b border-sidebar-border print:hidden">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display font-bold text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" />
            SEO Command
          </div>
          {report && (
            <Button size="sm" variant="outline" className="text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent" onClick={() => window.print()}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Download PDF
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading report…</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <FileBarChart className="h-12 w-12 text-muted-foreground/40" />
            <p className="font-semibold">Report not found</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              This report link may have expired or been deleted. Please contact the sender.
            </p>
          </div>
        )}

        {report && <ReportContent report={report} />}
      </div>
    </div>
  );
}
