import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Clock, ChevronRight, BookOpen, TrendingUp, Lightbulb } from "lucide-react";

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags: string[];
  author: string;
  readingTime: number;
  featured: boolean;
  publishedAt: string;
}

interface BlogResponse {
  posts: BlogPost[];
  total: number;
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

function categoryClass(cat: string) {
  return CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
}

async function fetchPosts(params: { category?: string; search?: string; featured?: boolean; limit?: number; offset?: number }): Promise<BlogResponse> {
  const token = localStorage.getItem("auth_token");
  const url = new URL(`${import.meta.env.BASE_URL}api/blog`, window.location.origin);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.search) url.searchParams.set("search", params.search);
  if (params.featured) url.searchParams.set("featured", "true");
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.offset) url.searchParams.set("offset", String(params.offset));
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return res.json();
}

async function fetchCategories(): Promise<string[]> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${import.meta.env.BASE_URL}api/blog/categories`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

function PostCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <Card className={`h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer group border ${featured ? "border-primary/20 bg-gradient-to-br from-primary/5 to-background" : ""}`}>
        <CardContent className="p-5 flex flex-col gap-3 h-full">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryClass(post.category)}`}>{post.category}</span>
            {post.featured && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Featured</span>}
          </div>
          <h3 className={`font-semibold leading-snug group-hover:text-primary transition-colors ${featured ? "text-lg" : "text-base"}`}>{post.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{post.excerpt}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.readingTime} min read</span>
            <span>{new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

const PAGE_SIZE = 12;

export default function BlogPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [page, setPage] = useState(0);

  const { data: categories = [] } = useQuery({ queryKey: ["blog-categories"], queryFn: fetchCategories });

  const { data: featuredData } = useQuery({
    queryKey: ["blog-featured"],
    queryFn: () => fetchPosts({ featured: true, limit: 3 }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["blog-posts", debouncedSearch, selectedCategory, page],
    queryFn: () => fetchPosts({ search: debouncedSearch, category: selectedCategory, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const posts: BlogPost[] = data?.posts ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const featuredPosts: BlogPost[] = featuredData?.posts ?? [];

  function handleSearch(val: string) {
    setSearch(val);
    clearTimeout((window as any).__blogSearchTimer);
    (window as any).__blogSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(0);
    }, 350);
  }

  function handleCategory(cat: string) {
    setSelectedCategory(prev => prev === cat ? "" : cat);
    setPage(0);
  }

  return (
    <div className="min-h-screen">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-purple-500/5 border-b">
        <div className="max-w-5xl mx-auto px-6 py-14 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-3 py-1 rounded-full mb-4">
            <BookOpen className="h-4 w-4" />
            SEO & Marketing Blog
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">Expert Insights for Growth</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Actionable strategies, deep-dive guides, and the latest trends in SEO, content marketing, and digital growth.
          </p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-11 text-base"
              placeholder="Search articles…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {featuredPosts.length > 0 && !selectedCategory && !debouncedSearch && page === 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Featured Articles</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {featuredPosts.map(p => <PostCard key={p.id} post={p} featured />)}
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-2 mb-8">
          <Button
            variant={!selectedCategory ? "default" : "outline"}
            size="sm"
            onClick={() => handleCategory("")}
            className="rounded-full"
          >
            All Topics
          </Button>
          {categories.map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => handleCategory(cat)}
              className="rounded-full"
            >
              {cat}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            {selectedCategory ? selectedCategory : debouncedSearch ? `Results for "${debouncedSearch}"` : "All Articles"}
            {total > 0 && <span className="text-sm text-muted-foreground font-normal">({total})</span>}
          </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5 space-y-3"><Skeleton className="h-4 w-20" /><Skeleton className="h-5 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No articles found</p>
            <p className="text-sm">Try a different search or category</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map(p => <PostCard key={p.id} post={p} />)}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}
