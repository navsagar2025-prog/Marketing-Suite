import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, MessageCircle, Trash2, Eye } from "lucide-react";
import { apiFetch } from "@/lib/catalog-api";

interface ChatbotConfig {
  enabled: boolean; name: string; avatar: string; greeting: string; systemPrompt: string;
}
interface ChatMsg { role: "user" | "assistant"; content: string; at?: string }
interface ConversationRow {
  id: number; visitorId: string; ip: string | null; userAgent: string | null;
  pageUrl: string | null; messages: ChatMsg[]; createdAt: string; updatedAt: string;
}

export default function AdminChatbotPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery<ChatbotConfig>({
    queryKey: ["admin-chatbot-config"],
    queryFn: () => apiFetch<ChatbotConfig>("/admin/chatbot/config"),
  });

  const [draft, setDraft] = useState<ChatbotConfig | null>(null);
  useEffect(() => { if (config) setDraft(config); }, [config]);

  const saveMut = useMutation({
    mutationFn: (next: ChatbotConfig) => apiFetch<ChatbotConfig>("/admin/chatbot/config", {
      method: "PUT",
      body: JSON.stringify(next),
    }),
    onSuccess: () => {
      toast({ title: "Saved", description: "Public chatbot updated." });
      qc.invalidateQueries({ queryKey: ["admin-chatbot-config"] });
      qc.invalidateQueries({ queryKey: ["public-chatbot-config"] });
    },
    onError: (err) => toast({ title: "Save failed", description: err instanceof Error ? err.message : "", variant: "destructive" }),
  });

  const { data: convData } = useQuery<{ conversations: ConversationRow[]; total: number }>({
    queryKey: ["admin-chatbot-conversations"],
    queryFn: () => apiFetch("/admin/chatbot/conversations?limit=50"),
  });

  const [viewing, setViewing] = useState<ConversationRow | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/chatbot/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-chatbot-conversations"] });
      setViewing(null);
      toast({ title: "Deleted" });
    },
  });

  if (isLoading || !draft) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <MessageCircle className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Public Chatbot</h1>
          <p className="text-sm text-muted-foreground">A floating AI chat widget on every public marketing page.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Edit the bot's behaviour. Changes are live immediately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="font-medium">Enable chatbot</div>
              <div className="text-xs text-muted-foreground">When off, the widget is hidden from visitors.</div>
            </div>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
              data-testid="switch-chatbot-enabled"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bot-name">Bot name</Label>
              <Input
                id="bot-name"
                value={draft.name}
                maxLength={80}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                data-testid="input-chatbot-name"
              />
            </div>
            <div>
              <Label htmlFor="bot-avatar">Avatar URL (optional)</Label>
              <Input
                id="bot-avatar"
                value={draft.avatar}
                maxLength={500}
                onChange={(e) => setDraft({ ...draft, avatar: e.target.value })}
                placeholder="https://…/avatar.png"
                data-testid="input-chatbot-avatar"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="bot-greeting">Greeting message</Label>
            <Textarea
              id="bot-greeting"
              value={draft.greeting}
              maxLength={500}
              rows={2}
              onChange={(e) => setDraft({ ...draft, greeting: e.target.value })}
              data-testid="textarea-chatbot-greeting"
            />
          </div>

          <div>
            <Label htmlFor="bot-prompt">System prompt</Label>
            <Textarea
              id="bot-prompt"
              value={draft.systemPrompt}
              maxLength={4000}
              rows={8}
              onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
              data-testid="textarea-chatbot-system-prompt"
              className="font-mono text-xs"
            />
            <div className="text-xs text-muted-foreground mt-1">Tells the bot how to behave. Visitors never see this.</div>
          </div>

          <Button
            onClick={() => saveMut.mutate(draft)}
            disabled={saveMut.isPending}
            data-testid="button-save-chatbot-config"
          >
            {saveMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent conversations</CardTitle>
          <CardDescription>{convData?.total ?? 0} total. Click to view.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(convData?.conversations ?? []).length === 0 && (
            <div className="text-sm text-muted-foreground py-4 text-center">No conversations yet.</div>
          )}
          {(convData?.conversations ?? []).map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setViewing(c)}
              data-testid={`button-conversation-${c.id}`}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-md border hover:bg-muted/40 text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {c.messages[0]?.content?.slice(0, 80) ?? "(empty)"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {c.messages.length} msgs • {new Date(c.updatedAt).toLocaleString()} • {c.ip ?? "unknown"}
                </div>
              </div>
              <Badge variant="outline">{c.messages.length}</Badge>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conversation #{viewing?.id}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>Visitor: {viewing.visitorId}</div>
                <div>IP: {viewing.ip ?? "unknown"}</div>
                <div>Page: {viewing.pageUrl ?? "—"}</div>
                <div>Started: {new Date(viewing.createdAt).toLocaleString()}</div>
              </div>
              <div className="space-y-2">
                {viewing.messages.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === "user"
                        ? "ml-12 bg-blue-600 text-white rounded-lg p-2 text-sm whitespace-pre-wrap"
                        : "mr-12 bg-muted rounded-lg p-2 text-sm whitespace-pre-wrap"
                    }
                    data-testid={`view-message-${m.role}-${i}`}
                  >
                    {m.content}
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMut.mutate(viewing.id)}
                  disabled={deleteMut.isPending}
                  data-testid="button-delete-conversation"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
