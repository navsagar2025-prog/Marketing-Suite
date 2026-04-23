import { useState } from "react";
import { ImageIcon, Video, Trash2, Download, Copy, Check, ExternalLink, Film } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMediaAssets,
  useDeleteMediaAsset,
  useListWebsites,
  useListCampaigns,
  getListMediaAssetsQueryKey,
} from "@workspace/api-client-react";
import type { MediaAsset } from "@workspace/api-client-react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy} title="Copy URL">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function AssetCard({ asset, onDelete }: { asset: MediaAsset; onDelete: (id: number) => void }) {
  const isVideo = asset.type === "video";
  return (
    <Card className="group overflow-hidden" data-testid={`card-asset-${asset.id}`}>
      <div className="relative bg-muted aspect-video flex items-center justify-center overflow-hidden">
        {isVideo ? (
          <video
            src={asset.url}
            className="w-full h-full object-cover"
            controls
            preload="metadata"
          />
        ) : (
          <img
            src={asset.url}
            alt={asset.prompt}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
        <div className="absolute top-2 left-2">
          <Badge variant={isVideo ? "outline" : "secondary"} className="text-xs gap-1 bg-background/80 backdrop-blur-sm">
            {isVideo ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
            {isVideo ? "Video" : "Image"}
          </Badge>
        </div>
      </div>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{asset.prompt}</p>
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs text-muted-foreground">
            {new Date(asset.createdAt).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={asset.url} />
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Open in new tab">
              <a href={asset.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:text-destructive"
              onClick={() => onDelete(asset.id)}
              data-testid={`button-delete-asset-${asset.id}`}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MediaAssetsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"all" | "image" | "video">("all");
  const [websiteFilter, setWebsiteFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");

  const { data: websites } = useListWebsites();
  const { data: campaigns } = useListCampaigns();

  const params: Record<string, string | number> = {};
  if (activeTab !== "all") params.type = activeTab;
  if (websiteFilter !== "all") params.websiteId = parseInt(websiteFilter);
  if (campaignFilter !== "all") params.campaignId = parseInt(campaignFilter);

  const { data: assets, isLoading } = useListMediaAssets(
    Object.keys(params).length > 0 ? params : undefined
  );
  const deleteMutation = useDeleteMediaAsset();

  const handleDelete = (id: number) => {
    if (!confirm("Delete this media asset?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMediaAssetsQueryKey() });
        toast({ title: "Asset deleted" });
      },
      onError: () => toast({ title: "Failed to delete asset", variant: "destructive" }),
    });
  };

  const filtered = (assets ?? []).filter(a =>
    activeTab === "all" || a.type === activeTab
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Media Library</h1>
          <p className="text-sm text-muted-foreground mt-0.5">AI-generated images and videos for your campaigns</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={websiteFilter} onValueChange={v => { setWebsiteFilter(v); setCampaignFilter("all"); }}>
            <SelectTrigger className="w-40" data-testid="select-website-filter">
              <SelectValue placeholder="All websites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All websites</SelectItem>
              {(websites ?? []).map(w => (
                <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={campaignFilter} onValueChange={v => { setCampaignFilter(v); setWebsiteFilter("all"); }}>
            <SelectTrigger className="w-44" data-testid="select-campaign-filter">
              <SelectValue placeholder="All campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All campaigns</SelectItem>
              {(campaigns ?? []).map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as "all" | "image" | "video")}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          <TabsTrigger value="image" data-testid="tab-images">
            <ImageIcon className="h-3.5 w-3.5 mr-1.5" />Images
          </TabsTrigger>
          <TabsTrigger value="video" data-testid="tab-videos">
            <Video className="h-3.5 w-3.5 mr-1.5" />Videos
          </TabsTrigger>
        </TabsList>

        {["all", "image", "video"].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="aspect-video w-full rounded-lg" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                {tab === "video"
                  ? <Film className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  : <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />}
                <p className="text-sm font-medium">No {tab === "all" ? "media assets" : tab + "s"} yet</p>
                <p className="text-xs mt-1">Generate images or videos from the Social or Campaigns pages.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map(asset => (
                  <AssetCard key={asset.id} asset={asset} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
