import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Search, Link2, FileBarChart, TrendingUp, Globe, AlertCircle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface HealthData {
  website: { name: string; url: string; niche: string; seoScore: number | null };
  keywords: { total: number; ranking: number; topThree: number; topTen: number; avgRank: number };
  topKeywords: Array<{ keyword: string; rank: number | null; volume: number | null }>;
  backlinks: { total: number; newLast30: number };
  siteAudit: { healthScore: number | null; pagesCrawled: number; completedAt: string } | null;
  generatedAt: string;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground text-sm">—</span>;
  const color = score >= 80 ? "text-green-600 bg-green-50 dark:bg-green-950" : score >= 60 ? "text-yellow-600 bg-yellow-50 dark:bg-yellow-950" : "text-red-600 bg-red-50 dark:bg-red-950";
  return <span className={`px-2 py-0.5 rounded-md text-sm font-semibold ${color}`}>{score}/100</span>;
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export default function PublicHealthPage({ token }: { token: string }) {
  const { data, isLoading, error } = useQuery<HealthData>({
    queryKey: ["public-health", token],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/public/health/${token}`);
      if (!res.ok) throw new Error("Health dashboard not found");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display font-bold text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" />
            SEO Command — Live Health
          </div>
          {data && (
            <div className="text-xs opacity-70">
              Updated {new Date(data.generatedAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading live health data…</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground/40" />
            <p className="font-semibold">Dashboard not found</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              This share link may have been revoked. Please contact the owner.
            </p>
          </div>
        )}

        {data && (
          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-3">
                <Globe className="h-6 w-6 text-primary" />
                <h1 className="text-3xl font-bold font-display">{data.website.name}</h1>
                <ScoreBadge score={data.website.seoScore} />
              </div>
              <a href={data.website.url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                {data.website.url}
              </a>
              <div className="text-xs text-muted-foreground mt-1">Niche: {data.website.niche}</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Search} label="Keywords" value={data.keywords.total} sub={`${data.keywords.ranking} ranking`} />
              <StatCard icon={TrendingUp} label="Top 10" value={data.keywords.topTen} sub={`${data.keywords.topThree} in top 3`} />
              <StatCard icon={Link2} label="Backlinks" value={data.backlinks.total} sub={`+${data.backlinks.newLast30} in 30 days`} />
              <StatCard
                icon={FileBarChart}
                label="Site Health"
                value={data.siteAudit?.healthScore ?? "—"}
                sub={data.siteAudit ? `${data.siteAudit.pagesCrawled} pages` : "No audit yet"}
              />
            </div>

            {data.topKeywords.length > 0 && (
              <div className="border rounded-lg bg-card overflow-hidden">
                <div className="border-b p-4 font-semibold">Top Ranking Keywords</div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Keyword</th>
                      <th className="text-right p-3">Rank</th>
                      <th className="text-right p-3">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topKeywords.map((k, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-3 font-medium">{k.keyword}</td>
                        <td className="p-3 text-right">
                          <span className={`font-semibold ${k.rank && k.rank <= 3 ? "text-green-600" : k.rank && k.rank <= 10 ? "text-blue-600" : "text-muted-foreground"}`}>
                            #{k.rank}
                          </span>
                        </td>
                        <td className="p-3 text-right text-muted-foreground">{k.volume?.toLocaleString() ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-center text-xs text-muted-foreground py-6 border-t">
              Live SEO health dashboard — auto-refreshes every 5 minutes
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
