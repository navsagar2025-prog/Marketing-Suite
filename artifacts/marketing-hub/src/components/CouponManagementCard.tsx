import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tag, Plus, Trash2, Loader2, ToggleLeft, ToggleRight, RefreshCw } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Coupon = {
  id: number;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  appliesTo: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
};

async function fetchCoupons(token: string): Promise<Coupon[]> {
  const res = await fetch(`${BASE}/api/billing/coupons`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load coupons");
  return res.json();
}

async function createCoupon(token: string, body: Record<string, unknown>): Promise<Coupon> {
  const res = await fetch(`${BASE}/api/billing/coupons`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create coupon");
  return data;
}

async function toggleCoupon(token: string, id: number, isActive: boolean): Promise<Coupon> {
  const res = await fetch(`${BASE}/api/billing/coupons/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ isActive }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update coupon");
  return data;
}

async function deleteCoupon(token: string, id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/billing/coupons/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete coupon");
}

export function CouponManagementCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const token = localStorage.getItem("auth_token") ?? "";

  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [appliesTo, setAppliesTo] = useState("all");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: coupons, isLoading, refetch } = useQuery({
    queryKey: ["coupons-admin"],
    queryFn: () => fetchCoupons(token),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => createCoupon(token, body),
    onSuccess: () => {
      toast({ title: "Coupon created" });
      qc.invalidateQueries({ queryKey: ["coupons-admin"] });
      setShowForm(false);
      setCode(""); setDiscountValue(""); setMaxUses(""); setExpiresAt("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => toggleCoupon(token, id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons-admin"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCoupon(token, id),
    onSuccess: () => {
      toast({ title: "Coupon deleted" });
      qc.invalidateQueries({ queryKey: ["coupons-admin"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleCreate = () => {
    if (!code.trim() || !discountValue) return;
    const val = Number(discountValue);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Invalid discount value", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      code: code.trim(),
      discountType,
      discountValue: discountType === "fixed" ? Math.round(val * 100) : val,
      appliesTo,
      maxUses: maxUses ? Number(maxUses) : null,
      expiresAt: expiresAt || null,
    });
  };

  const fmtDiscount = (c: Coupon) =>
    c.discountType === "percent"
      ? `${c.discountValue}% off`
      : `₹${(c.discountValue / 100).toFixed(0)} off`;

  return (
    <Card data-testid="card-coupons">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">Coupon &amp; Discount Codes</CardTitle>
              {coupons && (
                <Badge variant="secondary" className="text-xs">
                  {coupons.filter(c => c.isActive).length} active
                </Badge>
              )}
            </div>
            <CardDescription className="mt-1">
              Create and manage promo codes for plan discounts. Percent or fixed ₹ off, plan-specific, with optional expiry and usage limits.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setShowForm(v => !v)}>
              <Plus className="h-4 w-4 mr-1" />
              New Coupon
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-semibold">Create New Coupon</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Code</label>
                <Input
                  placeholder="SUMMER20"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  className="font-mono uppercase"
                />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Applies To</label>
                <select
                  value={appliesTo}
                  onChange={e => setAppliesTo(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">All plans</option>
                  <option value="starter">Starter only</option>
                  <option value="growth">Growth only</option>
                  <option value="agency">Agency only</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Discount Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDiscountType("percent")}
                  className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                    discountType === "percent" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-muted-foreground/40"
                  }`}
                >
                  % Percent off
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType("fixed")}
                  className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                    discountType === "fixed" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-muted-foreground/40"
                  }`}
                >
                  ₹ Fixed amount
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {discountType === "percent" ? "Percent (1-100)" : "Amount (₹)"}
                </label>
                <Input
                  type="number"
                  placeholder={discountType === "percent" ? "20" : "500"}
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  min={1}
                  max={discountType === "percent" ? 100 : undefined}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Max uses</label>
                <Input
                  type="number"
                  placeholder="Unlimited"
                  value={maxUses}
                  onChange={e => setMaxUses(e.target.value)}
                  min={1}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expires</label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleCreate} disabled={createMutation.isPending || !code.trim() || !discountValue}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Create Coupon
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />)}
          </div>
        )}

        {!isLoading && (!coupons || coupons.length === 0) && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Tag className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No coupons yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first promo code to offer discounts to customers.</p>
          </div>
        )}

        {coupons && coupons.length > 0 && (
          <div className="space-y-2" data-testid="list-coupons">
            {coupons.map(c => (
              <div
                key={c.id}
                className={`flex items-center gap-3 p-3 rounded-md border text-sm ${c.isActive ? "bg-background" : "bg-muted/30 opacity-60"}`}
                data-testid={`coupon-row-${c.id}`}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-sm">{c.code}</span>
                    <Badge variant={c.isActive ? "default" : "secondary"} className="text-xs">
                      {c.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{fmtDiscount(c)}</Badge>
                    {c.appliesTo !== "all" && (
                      <Badge variant="outline" className="text-xs capitalize">{c.appliesTo} only</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.usedCount} used
                    {c.maxUses !== null ? ` / ${c.maxUses} max` : " (unlimited)"}
                    {c.expiresAt ? ` · Expires ${new Date(c.expiresAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title={c.isActive ? "Deactivate" : "Activate"}
                    onClick={() => toggleMutation.mutate({ id: c.id, isActive: !c.isActive })}
                    disabled={toggleMutation.isPending}
                  >
                    {c.isActive
                      ? <ToggleRight className="h-4 w-4 text-primary" />
                      : <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                    }
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    title="Delete"
                    onClick={() => deleteMutation.mutate(c.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
