import { useMemo, useState, type JSX } from "react";
import type * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Globe, Pause, Play, Eye } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { scaleLinear } from "d3-scale";

const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type LiveEvent = {
  id: number;
  path: string;
  referrer: string | null;
  country: string | null;
  visitorId: string | null;
  createdAt: string;
};

type CountryRow = { country: string | null; visitors: number; views: number };

type CountriesResponse = {
  minutes: number;
  activeVisitors: number;
  countries: CountryRow[];
};

const A2_TO_NAME: Record<string, string> = {
  US: "United States", GB: "United Kingdom", CA: "Canada", AU: "Australia", DE: "Germany",
  FR: "France", ES: "Spain", IT: "Italy", NL: "Netherlands", SE: "Sweden", NO: "Norway",
  DK: "Denmark", FI: "Finland", PL: "Poland", IE: "Ireland", PT: "Portugal", BE: "Belgium",
  CH: "Switzerland", AT: "Austria", CZ: "Czechia", GR: "Greece", RO: "Romania", HU: "Hungary",
  RU: "Russia", UA: "Ukraine", TR: "Turkey", IL: "Israel", AE: "United Arab Emirates",
  SA: "Saudi Arabia", IN: "India", PK: "Pakistan", BD: "Bangladesh", LK: "Sri Lanka",
  NP: "Nepal", CN: "China", JP: "Japan", KR: "South Korea", TW: "Taiwan", HK: "Hong Kong",
  SG: "Singapore", MY: "Malaysia", TH: "Thailand", VN: "Vietnam", PH: "Philippines",
  ID: "Indonesia", NZ: "New Zealand", BR: "Brazil", AR: "Argentina", MX: "Mexico",
  CL: "Chile", CO: "Colombia", PE: "Peru", VE: "Venezuela", ZA: "South Africa",
  NG: "Nigeria", KE: "Kenya", EG: "Egypt", MA: "Morocco", GH: "Ghana", ET: "Ethiopia",
};

// ISO numeric (used in world-atlas topojson) -> alpha-2
const NUM_TO_A2: Record<string, string> = {
  "004": "AF", "008": "AL", "012": "DZ", "024": "AO", "032": "AR", "036": "AU", "040": "AT",
  "048": "BH", "050": "BD", "056": "BE", "068": "BO", "070": "BA", "072": "BW", "076": "BR",
  "100": "BG", "104": "MM", "108": "BI", "112": "BY", "116": "KH", "120": "CM", "124": "CA",
  "140": "CF", "144": "LK", "148": "TD", "152": "CL", "156": "CN", "158": "TW", "170": "CO",
  "178": "CG", "180": "CD", "188": "CR", "191": "HR", "192": "CU", "196": "CY", "203": "CZ",
  "204": "BJ", "208": "DK", "214": "DO", "218": "EC", "222": "SV", "226": "GQ", "231": "ET",
  "232": "ER", "233": "EE", "242": "FJ", "246": "FI", "250": "FR", "262": "DJ", "266": "GA",
  "268": "GE", "270": "GM", "275": "PS", "276": "DE", "288": "GH", "300": "GR", "320": "GT",
  "324": "GN", "328": "GY", "332": "HT", "340": "HN", "344": "HK", "348": "HU", "352": "IS",
  "356": "IN", "360": "ID", "364": "IR", "368": "IQ", "372": "IE", "376": "IL", "380": "IT",
  "384": "CI", "388": "JM", "392": "JP", "398": "KZ", "400": "JO", "404": "KE", "408": "KP",
  "410": "KR", "414": "KW", "417": "KG", "418": "LA", "422": "LB", "426": "LS", "428": "LV",
  "430": "LR", "434": "LY", "440": "LT", "442": "LU", "450": "MG", "454": "MW", "458": "MY",
  "466": "ML", "470": "MT", "478": "MR", "480": "MU", "484": "MX", "496": "MN", "498": "MD",
  "499": "ME", "504": "MA", "508": "MZ", "512": "OM", "516": "NA", "524": "NP", "528": "NL",
  "540": "NC", "548": "VU", "554": "NZ", "558": "NI", "562": "NE", "566": "NG", "578": "NO",
  "586": "PK", "591": "PA", "598": "PG", "600": "PY", "604": "PE", "608": "PH", "616": "PL",
  "620": "PT", "624": "GW", "626": "TL", "630": "PR", "634": "QA", "642": "RO", "643": "RU",
  "646": "RW", "682": "SA", "686": "SN", "688": "RS", "694": "SL", "702": "SG", "703": "SK",
  "704": "VN", "705": "SI", "706": "SO", "710": "ZA", "716": "ZW", "724": "ES", "728": "SS",
  "729": "SD", "740": "SR", "748": "SZ", "752": "SE", "756": "CH", "760": "SY", "762": "TJ",
  "764": "TH", "768": "TG", "780": "TT", "784": "AE", "788": "TN", "792": "TR", "795": "TM",
  "800": "UG", "804": "UA", "807": "MK", "818": "EG", "826": "GB", "834": "TZ", "840": "US",
  "854": "BF", "858": "UY", "860": "UZ", "862": "VE", "882": "WS", "887": "YE", "894": "ZM",
};

const countryName = (code: string | null): string => {
  if (!code) return "Unknown";
  return A2_TO_NAME[code] ?? code;
};

const countryFlag = (code: string | null): string => {
  if (!code || code.length !== 2) return "🌐";
  const A = 0x1f1e6;
  const c = code.toUpperCase();
  return String.fromCodePoint(A + c.charCodeAt(0) - 65, A + c.charCodeAt(1) - 65);
};

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
};

const refererHost = (ref: string | null): string => {
  if (!ref) return "direct";
  try {
    const u = new URL(ref);
    return u.host;
  } catch {
    return ref.length > 30 ? `${ref.slice(0, 30)}…` : ref;
  }
};

function useAdminFetch<T>(queryKey: unknown[], path: string, refetchInterval: number | false, enabled = true) {
  const { token } = useAuth();
  return useQuery<T>({
    queryKey,
    refetchInterval: refetchInterval || false,
    refetchIntervalInBackground: false,
    enabled,
    queryFn: async () => {
      const r = await fetch(`${apiBase}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`Failed: ${r.status}`);
      return r.json();
    },
  });
}

export default function AdminLiveTrafficPage(): JSX.Element {
  const [paused, setPaused] = useState(false);
  const [windowMinutes, setWindowMinutes] = useState<5 | 15 | 60 | 1440>(60);

  const interval = paused ? false : 5_000;
  const { data: recent, isLoading: recentLoading } = useAdminFetch<{ events: LiveEvent[] }>(
    ["admin-live-recent"], "/api/admin/live-traffic/recent?limit=50", interval,
  );
  const { data: countries, isLoading: countriesLoading } = useAdminFetch<CountriesResponse>(
    ["admin-live-countries", windowMinutes], `/api/admin/live-traffic/countries?minutes=${windowMinutes}`, paused ? false : 15_000,
  );

  const countryByA2 = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of countries?.countries ?? []) {
      if (c.country) m.set(c.country, c.views);
    }
    return m;
  }, [countries]);

  const maxViews = useMemo(() => {
    let m = 0;
    for (const v of countryByA2.values()) if (v > m) m = v;
    return m;
  }, [countryByA2]);

  const colorScale = useMemo(
    () => scaleLinear<string>().domain([0, Math.max(1, maxViews)]).range(["hsl(var(--muted))", "hsl(var(--chart-1))"]),
    [maxViews],
  );

  const totalViews = (countries?.countries ?? []).reduce((s, c) => s + c.views, 0);
  const knownCountries = (countries?.countries ?? []).filter(c => c.country).length;

  return (
    <div className="p-6 space-y-6" data-testid="page-live-traffic">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Live Traffic</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time visitor activity, recent page views, and country distribution.</p>
        </div>
        <Button
          variant={paused ? "default" : "outline"}
          size="sm"
          onClick={() => setPaused(p => !p)}
          data-testid="button-toggle-pause"
        >
          {paused ? <><Play className="h-4 w-4 mr-1.5" /> Resume</> : <><Pause className="h-4 w-4 mr-1.5" /> Pause</>}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={Activity}
          color="text-pink-500"
          title="Active visitors (5m)"
          value={countriesLoading ? null : String(countries?.activeVisitors ?? 0)}
        />
        <StatCard
          icon={Eye}
          color="text-cyan-500"
          title={`Page views (last ${windowLabel(windowMinutes)})`}
          value={countriesLoading ? null : totalViews.toLocaleString()}
        />
        <StatCard
          icon={Globe}
          color="text-emerald-500"
          title="Countries reached"
          value={countriesLoading ? null : String(knownCountries)}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> World map</CardTitle>
          <div className="flex gap-1">
            {([5, 15, 60, 1440] as const).map(m => (
              <Button
                key={m}
                variant={windowMinutes === m ? "default" : "outline"}
                size="sm"
                onClick={() => setWindowMinutes(m)}
                data-testid={`button-window-${m}`}
              >
                {windowLabel(m)}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md bg-muted/20">
            <ComposableMap
              projectionConfig={{ scale: 140 }}
              width={900}
              height={420}
              style={{ width: "100%", height: "auto" }}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const numId = String(geo.id ?? "").padStart(3, "0");
                    const a2 = NUM_TO_A2[numId];
                    const v = a2 ? countryByA2.get(a2) ?? 0 : 0;
                    const fill = v > 0 ? colorScale(v) : "hsl(var(--muted))";
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="hsl(var(--border))"
                        strokeWidth={0.4}
                        style={{
                          default: { outline: "none" },
                          hover: { outline: "none", fill: "hsl(var(--chart-2))", cursor: "pointer" },
                          pressed: { outline: "none" },
                        }}
                      >
                        <title>{`${countryName(a2 ?? null)}: ${v} views`}</title>
                      </Geography>
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Color intensity reflects page views in the selected window.</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent page views</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (recent?.events.length ?? 0) === 0 ? (
              <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">No page views yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="text-left py-2">When</th>
                      <th className="text-left py-2">Country</th>
                      <th className="text-left py-2">Path</th>
                      <th className="text-left py-2">Referrer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(recent?.events ?? []).map(e => (
                      <tr key={e.id} data-testid={`row-event-${e.id}`} className="hover:bg-muted/40">
                        <td className="py-1.5 text-muted-foreground whitespace-nowrap">{timeAgo(e.createdAt)}</td>
                        <td className="py-1.5 whitespace-nowrap">
                          <span className="mr-1.5" title={countryName(e.country)}>{countryFlag(e.country)}</span>
                          <span className="text-xs text-muted-foreground">{e.country ?? "—"}</span>
                        </td>
                        <td className="py-1.5 font-mono text-xs truncate max-w-xs">{e.path}</td>
                        <td className="py-1.5 text-xs text-muted-foreground truncate max-w-[180px]">{refererHost(e.referrer)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By country</CardTitle>
          </CardHeader>
          <CardContent>
            {countriesLoading ? <Skeleton className="h-64 w-full" /> : (countries?.countries.length ?? 0) === 0 ? (
              <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">No data in this window.</div>
            ) : (
              <ul className="space-y-1.5">
                {(countries?.countries ?? []).slice(0, 12).map((c, i) => (
                  <li key={`${c.country ?? "x"}-${i}`} className="flex items-center justify-between text-sm" data-testid={`country-${c.country ?? "unknown"}`}>
                    <span className="flex items-center gap-2 truncate">
                      <span>{countryFlag(c.country)}</span>
                      <span className="truncate">{countryName(c.country)}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary">{c.visitors} v</Badge>
                      <span className="text-muted-foreground tabular-nums">{c.views} views</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function windowLabel(m: number): string {
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${m / 60}h`;
  return `${m / 1440}d`;
}

function StatCard({ icon: Icon, color, title, value }: {
  icon: React.ComponentType<{ className?: string }>; color: string; title: string; value: string | null;
}): JSX.Element {
  return (
    <Card data-testid={`stat-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase font-medium text-muted-foreground tracking-wider">{title}</p>
            {value === null ? <Skeleton className="h-7 w-20 mt-1" /> : <p className="text-2xl font-bold font-display mt-1">{value}</p>}
          </div>
          <Icon className={`h-5 w-5 ${color} mt-1`} />
        </div>
      </CardContent>
    </Card>
  );
}
