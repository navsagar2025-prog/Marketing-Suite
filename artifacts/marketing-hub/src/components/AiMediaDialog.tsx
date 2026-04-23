import { useState } from "react";
import { ImageIcon, Video, Sparkles, Loader2, Copy, Check, ExternalLink, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGenerateAiImage,
  useGenerateAiVideo,
  useGetSettings,
  getListMediaAssetsQueryKey,
} from "@workspace/api-client-react";
import type { MediaAsset } from "@workspace/api-client-react";
import { Link } from "wouter";

interface AiMediaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId?: number | null;
  campaignId?: number | null;
  onSelect?: (asset: MediaAsset) => void;
}

const IMAGE_ASPECT_RATIOS = [
  { value: "1:1", label: "Square (1:1)" },
  { value: "16:9", label: "Landscape (16:9)" },
  { value: "9:16", label: "Portrait (9:16)" },
  { value: "4:3", label: "Widescreen (4:3)" },
];

const VIDEO_ASPECT_RATIOS = [
  { value: "16:9", label: "Landscape (16:9)" },
  { value: "9:16", label: "Portrait / Reels (9:16)" },
];

const VIDEO_DURATIONS = [
  { value: "5", label: "5 seconds" },
  { value: "10", label: "10 seconds" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handle} title="Copy URL">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

export function AiMediaDialog({ open, onOpenChange, websiteId, campaignId, onSelect }: AiMediaDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"image" | "video">("image");
  const [prompt, setPrompt] = useState("");
  const [imageAspect, setImageAspect] = useState("16:9");
  const [videoAspect, setVideoAspect] = useState("16:9");
  const [videoDuration, setVideoDuration] = useState("5");
  const [result, setResult] = useState<MediaAsset | null>(null);

  const { data: settings } = useGetSettings();
  const keyConfigured = settings?.falApiKeyConfigured === true;

  const imageMutation = useGenerateAiImage();
  const videoMutation = useGenerateAiVideo();

  const isPending = imageMutation.isPending || videoMutation.isPending;

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setResult(null);

    const onSuccess = (asset: MediaAsset) => {
      setResult(asset);
      queryClient.invalidateQueries({ queryKey: getListMediaAssetsQueryKey() });
      toast({ title: tab === "image" ? "Image generated!" : "Video generated!" });
    };
    const onError = (err: Error) => {
      const msg = err?.message?.includes("503") || err?.message?.toLowerCase().includes("not configured")
        ? "Fal.ai API key not configured. Please add it in Settings."
        : tab === "image" ? "Image generation failed" : "Video generation failed";
      toast({ title: msg, variant: "destructive" });
    };

    if (tab === "image") {
      imageMutation.mutate({
        data: {
          prompt: prompt.trim(),
          aspectRatio: imageAspect,
          websiteId: websiteId ?? null,
          campaignId: campaignId ?? null,
        },
      }, { onSuccess, onError });
    } else {
      videoMutation.mutate({
        data: {
          prompt: prompt.trim(),
          aspectRatio: videoAspect,
          durationSeconds: parseInt(videoDuration),
          websiteId: websiteId ?? null,
          campaignId: campaignId ?? null,
        },
      }, { onSuccess, onError });
    }
  };

  const handleSelect = () => {
    if (result && onSelect) {
      onSelect(result);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setResult(null);
    setPrompt("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate AI Media
          </DialogTitle>
        </DialogHeader>

        {!keyConfigured && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Fal.ai API key not configured.{" "}
              <Link href="/settings" className="underline font-medium" onClick={handleClose}>
                Go to Settings
              </Link>{" "}
              to add your key.
            </span>
          </div>
        )}

        <Tabs value={tab} onValueChange={v => { setTab(v as "image" | "video"); setResult(null); }}>
          <TabsList className="w-full">
            <TabsTrigger value="image" className="flex-1" data-testid="tab-generate-image">
              <ImageIcon className="h-3.5 w-3.5 mr-1.5" />Image
            </TabsTrigger>
            <TabsTrigger value="video" className="flex-1" data-testid="tab-generate-video">
              <Video className="h-3.5 w-3.5 mr-1.5" />Video
            </TabsTrigger>
          </TabsList>

          <TabsContent value="image" className="space-y-3 mt-3">
            <div>
              <label className="text-sm font-medium">Prompt</label>
              <Textarea
                data-testid="input-generate-prompt"
                className="mt-1"
                rows={3}
                placeholder="Describe the image you want to generate..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Aspect Ratio</label>
              <Select value={imageAspect} onValueChange={setImageAspect}>
                <SelectTrigger className="mt-1" data-testid="select-image-aspect">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_ASPECT_RATIOS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="video" className="space-y-3 mt-3">
            <div>
              <label className="text-sm font-medium">Prompt</label>
              <Textarea
                data-testid="input-generate-prompt"
                className="mt-1"
                rows={3}
                placeholder="Describe the video clip you want to generate..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Aspect Ratio</label>
                <Select value={videoAspect} onValueChange={setVideoAspect}>
                  <SelectTrigger className="mt-1" data-testid="select-video-aspect">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_ASPECT_RATIOS.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Duration</label>
                <Select value={videoDuration} onValueChange={setVideoDuration}>
                  <SelectTrigger className="mt-1" data-testid="select-video-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_DURATIONS.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {tab === "video" && (
              <p className="text-xs text-muted-foreground">Video generation takes 1-3 minutes. The page will wait while it's processing.</p>
            )}
          </TabsContent>
        </Tabs>

        <Button
          data-testid="button-generate-media"
          onClick={handleGenerate}
          disabled={isPending || !prompt.trim() || !keyConfigured}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating {tab}...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate {tab === "image" ? "Image" : "Video"}
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-2">
            <div className="rounded-md overflow-hidden border bg-muted">
              {result.type === "video" ? (
                <video src={result.url} controls className="w-full" />
              ) : (
                <img src={result.url} alt={result.prompt} className="w-full object-contain max-h-64" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground flex-1 line-clamp-1">{result.prompt}</p>
              <CopyButton text={result.url} />
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Open in new tab">
                <a href={result.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
            {onSelect && (
              <Button
                data-testid="button-use-media"
                variant="outline"
                onClick={handleSelect}
                className="w-full"
              >
                Use This {result.type === "video" ? "Video" : "Image"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
