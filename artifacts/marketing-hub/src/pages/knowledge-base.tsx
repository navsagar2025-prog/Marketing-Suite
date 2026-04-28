import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, ChevronRight, BookOpen, HelpCircle, Folder, ThumbsUp } from "lucide-react";

interface KbArticle {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  subcategory: string | null;
  tags: string[];
  helpful: number;
  createdAt: string;
}

interface KbResponse {
  articles: KbArticle[];
  total: number;
}

const CATEGORY_ICONS: Record<string, JSX.Element> = {
  "Getting Started": <BookOpen className="h-5 w-5" />,
  "Website Management": <Folder className="h-5 w-5" />,
  "Keyword Tracking": <Search className="h-5 w-5" />,
  "SEO Audits": <HelpCircle className="h-5 w-5" />,
  "Campaigns": <ChevronRight className="h-5 w-5" />,
  "Analytics": <ThumbsUp className="h-5 w-5" />,
  "AI Tools": <HelpCircle className="h-5 w-5" />,
  "Integrations": <Folder className="h-5 w-5" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  "Getting Started": "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800",
  "Website Management": "bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800",
  "Keyword Tracking": "bg-purple-50 border-purple-200 dark:bg-purple-900/10 dark:border-purple-800",
  "SEO Audits": "bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800",
  "Campaigns": "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-800",
  "Analytics": "bg-teal-50 border-teal-200 dark:bg-teal-900/10 dark:border-teal-800",
  "AI Tools": "bg-violet-50 border-violet-200 dark:bg-violet-900/10 dark:border-violet-800",
  "Integrations": "bg-rose-50 border-rose-200 dark:bg-rose-900/10 dark:border-rose-800",
};

async function fetchArticles(params: { category?: string; search?: string }): Promise<KbResponse> {
  const token = localStorage.getItem("auth_token");
  const url = new URL(`${import.meta.env.BASE_URL}api/kb`, window.location.origin);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.search) url.searchParams.set("search", params.search);
  url.searchParams.set("limit", "100");
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return res.json();
}

async function fetchCategories(): Promise<Record<string, string[]>> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${import.meta.env.BASE_URL}api/kb/categories`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

function ArticleCard({ article }: { article: KbArticle }) {
  return (
    <Link href={`/kb/${article.slug}`}>
      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer group transition-colors border border-transparent hover:border-border">
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium group-hover:text-primary transition-colors leading-snug">{article.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{article.excerpt}</p>
          {article.helpful > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <ThumbsUp className="h-3 w-3" />{article.helpful} found helpful
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function KnowledgeBasePage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const { data: categories = {} } = useQuery({ queryKey: ["kb-categories"], queryFn: fetchCategories });
  const { data, isLoading } = useQuery({
    queryKey: ["kb-articles", debouncedSearch, selectedCategory],
    queryFn: () => fetchArticles({ search: debouncedSearch, category: selectedCategory }),
    placeholderData: keepPreviousData,
  });

  const articles: KbArticle[] = data?.articles ?? [];
  const total: number = data?.total ?? 0;

  const grouped = articles.reduce<Record<string, KbArticle[]>>((acc, a) => {
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {});

  const categoryList = Object.keys(categories);

  function handleSearch(val: string) {
    setSearch(val);
    clearTimeout((window as any).__kbSearchTimer);
    (window as any).__kbSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
    }, 350);
  }

  return (
    <div className="min-h-screen">
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500/10 via-background to-purple-500/5 border-b">
        <div className="max-w-5xl mx-auto px-6 py-14 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-sm font-medium px-3 py-1 rounded-full mb-4">
            <HelpCircle className="h-4 w-4" />
            Knowledge Base
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">How Can We Help You?</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Find answers to your questions, step-by-step guides, and in-depth documentation for all platform features.
          </p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-11 text-base"
              placeholder="Search knowledge base…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
          {total > 0 && <p className="text-sm text-muted-foreground mt-3">{total} articles available</p>}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
          <aside className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-3">Categories</p>
            <button
              onClick={() => setSelectedCategory("")}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${!selectedCategory ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <BookOpen className="h-4 w-4 shrink-0" />All Articles
            </button>
            {categoryList.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(prev => prev === cat ? "" : cat)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${selectedCategory === cat ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                <span className="shrink-0">{CATEGORY_ICONS[cat] ?? <Folder className="h-4 w-4" />}</span>
                <span className="truncate">{cat}</span>
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${selectedCategory === cat ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {articles.filter(a => a.category === cat).length || ""}
                </span>
              </button>
            ))}
          </aside>

          <div>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}><CardHeader><Skeleton className="h-5 w-32" /></CardHeader><CardContent className="space-y-2">{Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-4 w-full" />)}</CardContent></Card>
                ))}
              </div>
            ) : articles.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">No articles found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(grouped).map(([cat, arts]) => (
                  <Card key={cat} className={`border ${CATEGORY_COLORS[cat] ?? ""}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="text-muted-foreground">{CATEGORY_ICONS[cat] ?? <Folder className="h-5 w-5" />}</span>
                        {cat}
                        <Badge variant="secondary" className="ml-auto text-xs">{arts.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-0.5">
                        {arts.slice(0, 8).map(a => <ArticleCard key={a.id} article={a} />)}
                        {arts.length > 8 && (
                          <button
                            onClick={() => setSelectedCategory(cat)}
                            className="text-xs text-primary font-medium px-3 pt-2 hover:underline"
                          >
                            +{arts.length - 8} more articles
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
