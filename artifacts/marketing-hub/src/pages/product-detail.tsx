import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ArrowLeft } from "lucide-react";
import { apiFetch, type Product } from "@/lib/catalog-api";

export default function ProductDetailPage() {
  const [, params] = useRoute("/products/:slug");
  const slug = params?.slug ?? "";
  const [activeImg, setActiveImg] = useState<string | null>(null);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["public-product", slug],
    queryFn: () => apiFetch<Product>(`/products/${slug}`),
    enabled: !!slug,
  });

  useEffect(() => {
    if (product?.jsonLd) {
      const el = document.createElement("script");
      el.type = "application/ld+json";
      el.text = JSON.stringify(product.jsonLd);
      el.id = "product-jsonld";
      document.head.appendChild(el);
      return () => { document.getElementById("product-jsonld")?.remove(); };
    }
  }, [product]);

  if (isLoading) return <div className="max-w-5xl mx-auto p-6"><Skeleton className="h-96 rounded-lg" /></div>;
  if (error || !product) return (
    <div className="max-w-5xl mx-auto p-6 text-center space-y-4">
      <Package className="h-16 w-16 mx-auto text-muted-foreground/40" />
      <h2 className="text-xl font-semibold">Product not found</h2>
      <Link href="/products"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1" /> Back to products</Button></Link>
    </div>
  );

  const allImages = [product.heroImage, ...(product.images?.map(i => i.url) ?? [])].filter((u): u is string => !!u);
  const mainImage = activeImg ?? allImages[0] ?? null;
  const features = Array.isArray(product.features) ? product.features as Array<{ key: string; value: string }> : [];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Link href="/products"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> All products</Button></Link>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3">
          {mainImage ? (
            <img src={mainImage} alt={product.name} className="w-full aspect-square object-cover rounded-lg border" />
          ) : (
            <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center"><Package className="h-24 w-24 text-muted-foreground" /></div>
          )}
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {allImages.map((u, i) => (
                <button key={i} onClick={() => setActiveImg(u)} className={`h-16 w-16 rounded border shrink-0 overflow-hidden ${(activeImg ?? allImages[0]) === u ? "ring-2 ring-primary" : ""}`}>
                  <img src={u} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{product.category}</Badge>
            {product.brand && <Badge>{product.brand.name}</Badge>}
          </div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          {product.price && <div className="text-2xl font-bold text-primary">{product.price}</div>}
          {product.shortDescription && <p className="text-lg text-muted-foreground">{product.shortDescription}</p>}
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">{product.description}</div>
          {features.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Features</h3>
                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                  {features.map((f, i) => (
                    <div key={i}>
                      <dt className="text-muted-foreground">{f.key}</dt>
                      <dd className="font-medium">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}
          {product.brand && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                {product.brand.logoUrl && <img src={product.brand.logoUrl} alt="" className="h-10 w-10 object-contain bg-white rounded border" />}
                <div className="flex-1">
                  <div className="font-semibold">{product.brand.name}</div>
                  {product.brand.description && <p className="text-xs text-muted-foreground">{product.brand.description}</p>}
                </div>
                {product.brand.websiteUrl && <a href={product.brand.websiteUrl} target="_blank" rel="noreferrer"><Button variant="outline" size="sm">Visit</Button></a>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
