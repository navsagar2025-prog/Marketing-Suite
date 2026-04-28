import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Clock, User, Calendar, Tag, BookOpen, Share2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  seoTitle: string | null;
  seoDescription: string | null;
  readingTime: number;
  featured: boolean;
  publishedAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "SEO Basics": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Keyword Research": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "Content Marketing": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Link Building": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "Technical SEO": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "Local SEO": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "Social Media": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  "Analytics": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  "Campaigns": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  "AI & Tools": "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
};

async function fetchPost(slug: string): Promise<BlogPost> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${import.meta.env.BASE_URL}api/blog/${slug}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Not found");
  return res.json();
}

async function fetchRelated(category: string, currentSlug: string): Promise<BlogPost[]> {
  const token = localStorage.getItem("auth_token");
  const url = new URL(`${import.meta.env.BASE_URL}api/blog`, window.location.origin);
  url.searchParams.set("category", category);
  url.searchParams.set("limit", "4");
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const data = await res.json();
  return (data.posts as BlogPost[]).filter(p => p.slug !== currentSlug).slice(0, 3);
}

function categoryClass(cat: string) {
  return CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
}

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const { data: post, isLoading, isError } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: () => fetchPost(slug),
    enabled: !!slug,
  });

  const { data: related = [] } = useQuery({
    queryKey: ["blog-related", post?.category, slug],
    queryFn: () => fetchRelated(post!.category, slug),
    enabled: !!post,
  });

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast({ title: "Link copied!", description: "Article URL copied to clipboard." });
    });
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-40" />
        <div className="space-y-3 pt-6">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </div>
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-semibold mb-2">Article not found</h2>
        <p className="text-muted-foreground mb-6">This article may have been moved or deleted.</p>
        <Link href="/blog"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back to Blog</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/blog">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />Back to Blog
          </Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={handleShare} className="gap-2 text-muted-foreground hover:text-foreground ml-auto">
          <Share2 className="h-4 w-4" />Share
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10">
        <article>
          <div className="mb-6">
            <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-4 ${categoryClass(post.category)}`}>{post.category}</span>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">{post.title}</h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">{post.excerpt}</p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-t border-b py-3">
              <span className="flex items-center gap-1.5"><User className="h-4 w-4" />{post.author}</span>
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{post.readingTime} min read</span>
            </div>
          </div>

          <div
            className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-li:leading-relaxed prose-strong:text-foreground"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {post.tags.length > 0 && (
            <div className="mt-8 pt-6 border-t flex flex-wrap gap-2 items-center">
              <Tag className="h-4 w-4 text-muted-foreground" />
              {post.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
        </article>

        <aside className="space-y-6">
          {related.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Related Articles</h3>
              <div className="space-y-3">
                {related.map(r => (
                  <Link key={r.id} href={`/blog/${r.slug}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                      <CardContent className="p-4 space-y-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryClass(r.category)}`}>{r.category}</span>
                        <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">{r.title}</p>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{r.readingTime} min</span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-5">
              <h3 className="font-semibold mb-2">Explore More Topics</h3>
              <p className="text-sm text-muted-foreground mb-3">Browse all our SEO and marketing guides organized by topic.</p>
              <Link href="/blog"><Button size="sm" className="w-full">View All Articles</Button></Link>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
