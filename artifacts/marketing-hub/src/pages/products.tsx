import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Package, ArrowRight } from "lucide-react";
import { apiFetch, type Product, type Brand } from "@/lib/catalog-api";

const PUBLIC_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["public-products", search, category, brand],
    queryFn: () => {
      const u = new URLSearchParams();
      if (search) u.set("search", search);
      if (category) u.set("category", category);
      if (brand) u.set("brand", brand);
      return apiFetch<{ products: Product[]; total: number }>(`/products?${u.toString()}`);
    },
  });
  const { data: categories = [] } = useQuery({ queryKey: ["public-product-categories"], queryFn: () => apiFetch<string[]>("/products/categories") });
  const { data: brands = [] } = useQuery({ queryKey: ["public-brands"], queryFn: () => apiFetch<Brand[]>("/brands") });

  const products = data?.products ?? [];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Package className="h-7 w-7" /> Products</h1>
        <p className="text-muted-foreground">Browse our full product catalog.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="h-10 rounded-md border px-3 text-sm bg-background" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="h-10 rounded-md border px-3 text-sm bg-background" value={brand} onChange={e => setBrand(e.target.value)}>
          <option value="">All brands</option>
          {brands.map(b => <option key={b.id} value={b.slug}>{b.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-lg" />)}
        </div>
      ) : products.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No products found.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <Link key={p.id} href={`/products/${p.slug}`}>
              <Card className="cursor-pointer hover:shadow-md transition overflow-hidden">
                {p.heroImage ? <img src={p.heroImage} alt={p.name} className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-muted flex items-center justify-center"><Package className="h-12 w-12 text-muted-foreground" /></div>}
                <CardContent className="p-4 space-y-1">
                  <Badge variant="outline" className="text-xs">{p.category}</Badge>
                  <h3 className="font-semibold text-lg leading-tight">{p.name}</h3>
                  {p.shortDescription && <p className="text-sm text-muted-foreground line-clamp-2">{p.shortDescription}</p>}
                  <div className="flex items-center justify-between pt-2">
                    {p.price ? <span className="font-bold text-primary">{p.price}</span> : <span />}
                    <Button size="sm" variant="ghost">View <ArrowRight className="h-3 w-3 ml-1" /></Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
