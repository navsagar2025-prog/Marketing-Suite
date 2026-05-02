import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useListWebsites } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Sparkles, CheckCircle2, Circle, ExternalLink, Loader2, ChevronDown, ChevronRight, Zap, TrendingUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "auth_token";
function authHeader() { return { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ""}` }; }
const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Suggestion = {
  keyword: string;
  intent: "transactional" | "informational" | "navigational";
  volumeBand: "<100" | "100-1K" | "1K-10K" | "10K+";
  difficulty: number;
  tip: string;
};

const INTENT_COLORS: Record<string, string> = {
  transactional: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  informational: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  navigational: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

const DIFFICULTY_COLOR = (d: number) =>
  d <= 25 ? "text-green-600" : d <= 50 ? "text-amber-600" : d <= 75 ? "text-orange-600" : "text-red-600";

type Citation = {
  name: string;
  url: string;
  category: string;
  priority: "must-have" | "recommended" | "niche";
};

const CITATIONS: Citation[] = [
  { name: "Google Business Profile", url: "https://business.google.com", category: "Search", priority: "must-have" },
  { name: "Bing Places for Business", url: "https://www.bingplaces.com", category: "Search", priority: "must-have" },
  { name: "Apple Maps Connect", url: "https://mapsconnect.apple.com", category: "Maps", priority: "must-have" },
  { name: "Yelp for Business", url: "https://biz.yelp.com", category: "Reviews", priority: "must-have" },
  { name: "Facebook Business", url: "https://www.facebook.com/business", category: "Social", priority: "must-have" },
  { name: "TripAdvisor", url: "https://www.tripadvisor.com/Owners.html", category: "Reviews", priority: "recommended" },
  { name: "Foursquare", url: "https://foursquare.com/business", category: "Maps", priority: "recommended" },
  { name: "Yellow Pages", url: "https://www.yellowpages.com", category: "Directory", priority: "recommended" },
  { name: "Better Business Bureau", url: "https://www.bbb.org", category: "Trust", priority: "recommended" },
  { name: "Angi (Angie's List)", url: "https://www.angi.com", category: "Home Services", priority: "recommended" },
  { name: "Thumbtack", url: "https://www.thumbtack.com/pro", category: "Services", priority: "recommended" },
  { name: "Nextdoor", url: "https://business.nextdoor.com", category: "Local", priority: "recommended" },
  { name: "LinkedIn Company Page", url: "https://www.linkedin.com/company/setup/new", category: "Social", priority: "recommended" },
  { name: "Manta", url: "https://www.manta.com", category: "Directory", priority: "niche" },
  { name: "Superpages", url: "https://www.superpages.com", category: "Directory", priority: "niche" },
  { name: "CitySearch", url: "https://www.citysearch.com", category: "Directory", priority: "niche" },
  { name: "Merchant Circle", url: "https://www.merchantcircle.com", category: "Directory", priority: "niche" },
  { name: "Chamber of Commerce", url: "https://www.chamberofcommerce.com", category: "Local", priority: "niche" },
  { name: "Alignable", url: "https://www.alignable.com", category: "Network", priority: "niche" },
  { name: "Hotfrog", url: "https://www.hotfrog.com", category: "Directory", priority: "niche" },
];

const PRIORITY_LABEL: Record<Citation["priority"], string> = {
  "must-have": "Must-have",
  recommended: "Recommended",
  niche: "Nice to have",
};

const PRIORITY_COLOR: Record<Citation["priority"], string> = {
  "must-have": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  recommended: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  niche: "bg-muted text-muted-foreground",
};

const SCHEMA_TYPES = [
  { type: "LocalBusiness", description: "Generic local business — shops, services, professional offices." },
  { type: "Restaurant", description: "Restaurants, cafes, bars, food trucks." },
  { type: "MedicalBusiness", description: "Clinics, hospitals, dental, optometry." },
  { type: "LawFirm", description: "Law firms, attorneys, solicitors." },
  { type: "RealEstateAgent", description: "Real estate agencies and agents." },
  { type: "HomeAndConstructionBusiness", description: "Plumbers, electricians, contractors, roofers." },
  { type: "AutomotiveBusiness", description: "Auto repair, car dealers, car wash." },
  { type: "BeautySalon", description: "Hair salons, spas, nail studios." },
  { type: "FitnessCenter", description: "Gyms, yoga studios, personal trainers." },
  { type: "TravelAgency", description: "Travel agencies, tour operators." },
];

export default function LocalSeoPage() {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [location, setLocation] = useState("");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const [checkedCitations, setCheckedCitations] = useState<Set<string>>(new Set());
  const [showAllCitations, setShowAllCitations] = useState(false);
  const [citationFilter, setCitationFilter] = useState<"all" | Citation["priority"]>("all");

  const { data: websites } = useListWebsites();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const wsId = selectedWebsiteId ? parseInt(selectedWebsiteId) : undefined;
      const res = await fetch(`${BASE_URL}/api/local-seo/keywords`, {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), location: location.trim() || undefined, websiteId: wsId }),
      });
      if (res.status === 429) throw new Error("AI limit reached. Try again later.");
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(e?.error ?? "Generation failed");
      }
      return res.json() as Promise<{ suggestions: Suggestion[] }>;
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions);
      if (data.suggestions.length === 0) {
        toast({ title: "No suggestions returned", description: "Try a more specific topic or location.", variant: "destructive" });
      }
    },
    onError: (err: Error) => toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
  });

  const toggleCitation = (name: string) => {
    setCheckedCitations(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const visibleCitations = CITATIONS.filter(c =>
    citationFilter === "all" || c.priority === citationFilter
  );

  const completed = CITATIONS.filter(c => checkedCitations.has(c.name)).length;
  const mustHaveDone = CITATIONS.filter(c => c.priority === "must-have" && checkedCitations.has(c.name)).length;
  const mustHaveTotal = CITATIONS.filter(c => c.priority === "must-have").length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" />
          Local SEO
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Dominate local search — find geo-targeted keywords, track your directory citations, and pick the right schema markup.
        </p>
      </div>

      {/* ── Local Keyword Suggestions ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">AI Local Keyword Suggestions</CardTitle>
          </div>
          <CardDescription className="mt-0.5">
            Enter your service and target city to get 20 geo-targeted keyword ideas optimised for local search.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Service / Topic</label>
              <Input
                placeholder="e.g. Plumber, Dentist, Bakery"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === "Enter" && topic.trim() && generateMutation.mutate()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Target Location <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                placeholder="e.g. Austin TX, London, Melbourne"
                value={location}
                onChange={e => setLocation(e.target.value)}
                onKeyDown={e => e.key === "Enter" && topic.trim() && generateMutation.mutate()}
              />
            </div>
            {websites && websites.length > 0 && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Website <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Select value={selectedWebsiteId} onValueChange={setSelectedWebsiteId}>
                  <SelectTrigger><SelectValue placeholder="Auto-detect niche" /></SelectTrigger>
                  <SelectContent>
                    {websites.map(w => (
                      <SelectItem key={w.id} value={String(w.id)}>{w.url}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Button
            onClick={() => generateMutation.mutate()}
            disabled={!topic.trim() || generateMutation.isPending}
          >
            {generateMutation.isPending
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>
              : <><Sparkles className="h-4 w-4 mr-2" />Generate Local Keywords</>
            }
          </Button>

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">{suggestions.length} suggestions · click a row to see the content tip</p>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-xs">Keyword</th>
                      <th className="text-center py-2 px-3 font-medium text-xs">Intent</th>
                      <th className="text-center py-2 px-3 font-medium text-xs">Volume</th>
                      <th className="text-center py-2 px-3 font-medium text-xs">Difficulty</th>
                      <th className="w-6 py-2 px-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map((s, i) => (
                      <>
                        <tr
                          key={i}
                          className={cn("border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors", expandedTip === i && "bg-muted/30")}
                          onClick={() => setExpandedTip(expandedTip === i ? null : i)}
                        >
                          <td className="py-2 px-3 font-medium">{s.keyword}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant="outline" className={cn("text-[10px] capitalize", INTENT_COLORS[s.intent])}>
                              {s.intent}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-xs tabular-nums">{s.volumeBand}</span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={cn("text-xs font-semibold tabular-nums", DIFFICULTY_COLOR(s.difficulty))}>
                              {s.difficulty}/100
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-muted-foreground">
                            {expandedTip === i ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </td>
                        </tr>
                        {expandedTip === i && (
                          <tr key={`${i}-tip`} className="bg-primary/5 border-b last:border-0">
                            <td colSpan={5} className="py-2.5 px-3">
                              <div className="flex items-start gap-2">
                                <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                                <p className="text-xs text-muted-foreground">{s.tip}</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Citation Checklist ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Citation Checklist</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                {mustHaveDone}/{mustHaveTotal} must-haves · {completed}/{CITATIONS.length} total
              </span>
            </div>
          </div>
          <CardDescription className="mt-0.5">
            Track which business directories you're listed on. Consistent NAP (Name, Address, Phone) across all citations boosts local rankings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${CITATIONS.length > 0 ? (completed / CITATIONS.length) * 100 : 0}%` }}
              />
            </div>
            <div className="flex gap-2">
              {(["all", "must-have", "recommended", "niche"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setCitationFilter(f)}
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full border transition-colors",
                    citationFilter === f ? "border-primary bg-primary/10 text-primary" : "border-muted text-muted-foreground hover:border-muted-foreground"
                  )}
                >
                  {f === "all" ? "All" : PRIORITY_LABEL[f]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            {visibleCitations.map(c => {
              const done = checkedCitations.has(c.name);
              return (
                <div
                  key={c.name}
                  onClick={() => toggleCitation(c.name)}
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-md border cursor-pointer transition-colors",
                    done ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800" : "hover:bg-muted/40"
                  )}
                >
                  {done
                    ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", done && "line-through text-muted-foreground")}>{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.category}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className={cn("text-[10px]", PRIORITY_COLOR[c.priority])}>
                      {PRIORITY_LABEL[c.priority]}
                    </Badge>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Schema Markup Helper ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base">Schema Markup Selector</CardTitle>
          </div>
          <CardDescription className="mt-0.5">
            Use schema.org structured data to tell Google exactly what type of local business you are. Pick the type that best matches your business.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-2">
            {SCHEMA_TYPES.map(s => (
              <div key={s.type} className="flex items-start gap-3 p-3 rounded-md border hover:bg-muted/30 transition-colors">
                <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium font-mono">{s.type}</p>
                    <a
                      href={`https://schema.org/${s.type}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-md bg-muted/50 border text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">How to add schema to your site</p>
            <p>Add a <code className="font-mono bg-muted px-1 rounded">{"<script type=\"application/ld+json\">"}</code> tag in your page's <code className="font-mono bg-muted px-1 rounded">{"<head>"}</code> containing the JSON-LD for your chosen type. Include: <code className="font-mono bg-muted px-1 rounded">name</code>, <code className="font-mono bg-muted px-1 rounded">address</code>, <code className="font-mono bg-muted px-1 rounded">telephone</code>, <code className="font-mono bg-muted px-1 rounded">openingHours</code>, <code className="font-mono bg-muted px-1 rounded">geo</code>, and <code className="font-mono bg-muted px-1 rounded">url</code>.</p>
            <a href="https://search.google.com/test/rich-results" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline mt-1">
              Test your schema with Google's Rich Results Test <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
