import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Which keywords are ranking in the top 10?",
  "Summarise my website SEO scores",
  "What should I improve first?",
  "How many backlinks do I have?",
];

const TOKEN_KEY = "auth_token";

async function sendChat(messages: Message[]): Promise<string> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Chat failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { reply: string };
  return data.reply;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    setError(null);
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const reply = await sendChat(next);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      setMessages(next.slice(0, -1));
      setInput(content);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="button-chat-widget-toggle"
        className={cn(
          "fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all hover:scale-105",
          open && "scale-90"
        )}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      {open && (
        <div
          className="fixed bottom-24 right-5 z-50 w-[min(380px,calc(100vw-2.5rem))] h-[min(560px,calc(100vh-8rem))] rounded-xl border bg-background shadow-2xl flex flex-col overflow-hidden"
          data-testid="chat-widget-panel"
        >
          <div className="border-b p-3 flex items-center gap-2 bg-muted/30">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="font-semibold text-sm">Ask your SEO data</div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Hi! Ask me anything about your websites, keywords, rankings, or audits.
                </div>
                <div className="space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="w-full text-left text-xs px-3 py-2 rounded-md border hover:bg-muted transition"
                      data-testid={`button-chat-suggestion-${s.slice(0, 12).replace(/\s/g, "-")}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "text-sm rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap break-words",
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
                data-testid={`chat-message-${m.role}-${i}`}
              >
                {m.content}
              </div>
            ))}

            {loading && (
              <div className="bg-muted text-sm rounded-lg px-3 py-2 max-w-[85%] flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking…
              </div>
            )}

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 rounded-md p-2">
                {error}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t p-2 flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your data…"
              disabled={loading}
              data-testid="input-chat-message"
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading || !input.trim()}
              data-testid="button-chat-send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
