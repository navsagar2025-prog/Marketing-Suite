import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ThumbsUp, ThumbsDown, ChevronRight, HelpCircle, Tag } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface KbArticle {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  subcategory: string | null;
  tags: string[];
  helpful: number;
  notHelpful: number;
  createdAt: string;
}

async function fetchArticle(slug: string): Promise<KbArticle> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${import.meta.env.BASE_URL}api/kb/${slug}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Not found");
  return res.json();
}

async function fetchRelatedKb(category: string, currentSlug: string): Promise<Pick<KbArticle, "id" | "slug" | "title" | "excerpt" | "category">[]> {
  const token = localStorage.getItem("auth_token");
  const url = new URL(`${import.meta.env.BASE_URL}api/kb`, window.location.origin);
  url.searchParams.set("category", category);
  url.searchParams.set("limit", "6");
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const data = await res.json();
  return data.articles.filter((a: KbArticle) => a.slug !== currentSlug).slice(0, 5);
}

async function voteHelpful(slug: string, vote: "yes" | "no"): Promise<void> {
  const token = localStorage.getItem("auth_token");
  await fetch(`${import.meta.env.BASE_URL}api/kb/${slug}/helpful`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ vote }),
  });
}

export default function KbArticlePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [voted, setVoted] = useState<"yes" | "no" | null>(null);

  const { data: article, isLoading, isError } = useQuery({
    queryKey: ["kb-article", slug],
    queryFn: () => fetchArticle(slug),
    enabled: !!slug,
  });

  const { data: related = [] } = useQuery({
    queryKey: ["kb-related", article?.category, slug],
    queryFn: () => fetchRelatedKb(article!.category, slug),
    enabled: !!article,
  });

  async function handleVote(vote: "yes" | "no") {
    if (voted) return;
    setVoted(vote);
    await voteHelpful(slug, vote);
    toast({
      title: vote === "yes" ? "Thanks for your feedback!" : "Thanks for letting us know",
      description: vote === "yes" ? "We're glad this article was helpful." : "We'll work on improving this article.",
    });
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-60" />
        <div className="space-y-3 pt-6">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </div>
      </div>
    );
  }

  if (isError || !article) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <HelpCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-semibold mb-2">Article not found</h2>
        <p className="text-muted-foreground mb-6">This article may have been moved or deleted.</p>
        <Link href="/kb"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back to Knowledge Base</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-8 flex-wrap">
        <Link href="/kb"><span className="hover:text-foreground cursor-pointer transition-colors">Knowledge Base</span></Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <button onClick={() => window.history.back()} className="hover:text-foreground transition-colors">{article.category}</button>
        {article.subcategory && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>{article.subcategory}</span>
          </>
        )}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10">
        <article>
          <div className="mb-6">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="secondary">{article.category}</Badge>
              {article.subcategory && <Badge variant="outline">{article.subcategory}</Badge>}
            </div>
            <h1 className="text-3xl font-bold leading-tight mb-3">{article.title}</h1>
            <p className="text-muted-foreground leading-relaxed">{article.excerpt}</p>
          </div>

          <div
            className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-li:leading-relaxed prose-strong:text-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {article.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2 items-center pt-6 border-t">
              <Tag className="h-4 w-4 text-muted-foreground" />
              {article.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
            </div>
          )}

          <Card className="mt-8">
            <CardContent className="p-5">
              <p className="font-medium mb-3 text-center">Was this article helpful?</p>
              <div className="flex justify-center gap-3">
                <Button
                  variant={voted === "yes" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleVote("yes")}
                  disabled={!!voted}
                  className="gap-2"
                >
                  <ThumbsUp className="h-4 w-4" />
                  Yes, it helped
                  {article.helpful > 0 && <span className="text-xs opacity-70">({article.helpful})</span>}
                </Button>
                <Button
                  variant={voted === "no" ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => handleVote("no")}
                  disabled={!!voted}
                  className="gap-2"
                >
                  <ThumbsDown className="h-4 w-4" />
                  Not really
                </Button>
              </div>
              {voted && (
                <p className="text-center text-sm text-muted-foreground mt-3">
                  {voted === "yes" ? "Thanks! Your feedback helps us improve." : "We appreciate your feedback and will work on improving this article."}
                </p>
              )}
            </CardContent>
          </Card>
        </article>

        <aside className="space-y-6">
          {related.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Related Articles</h3>
              <div className="space-y-2">
                {related.map(r => (
                  <Link key={r.id} href={`/kb/${r.slug}`}>
                    <div className="p-3 rounded-lg hover:bg-muted cursor-pointer group transition-colors border border-transparent hover:border-border">
                      <p className="text-sm font-medium group-hover:text-primary transition-colors leading-snug">{r.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <Card className="bg-indigo-500/5 border-indigo-500/20">
            <CardContent className="p-5">
              <h3 className="font-semibold mb-2">Need More Help?</h3>
              <p className="text-sm text-muted-foreground mb-3">Browse all our guides or search for a specific topic.</p>
              <Link href="/kb"><Button size="sm" variant="outline" className="w-full">Browse Knowledge Base</Button></Link>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
