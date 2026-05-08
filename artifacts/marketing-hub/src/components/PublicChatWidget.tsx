import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/catalog-api";
import { cn } from "@/lib/utils";

interface PublicChatbotConfig { enabled: boolean; name: string; avatar: string; greeting: string }
type Msg = { role: "user" | "assistant"; content: string };

const VISITOR_KEY = "public_chat_visitor_id";
const CONV_KEY = "public_chat_conversation_id";

function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function PublicChatWidget() {
  const { data: config } = useQuery<PublicChatbotConfig>({
    queryKey: ["public-chatbot-config"],
    queryFn: () => apiFetch<PublicChatbotConfig>("/public/chatbot/config"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const greetedRef = useRef(false);

  useEffect(() => {
    if (open && config && !greetedRef.current && messages.length === 0) {
      setMessages([{ role: "assistant", content: config.greeting }]);
      greetedRef.current = true;
    }
  }, [open, config, messages.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  if (!config?.enabled) return null;

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const conversationIdRaw = localStorage.getItem(CONV_KEY);
      const conversationId = conversationIdRaw ? parseInt(conversationIdRaw) : undefined;
      const data = await apiFetch<{ reply: string; conversationId: number }>("/public/chat", {
        method: "POST",
        body: JSON.stringify({
          message: content,
          visitorId: getVisitorId(),
          conversationId,
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
      localStorage.setItem(CONV_KEY, String(data.conversationId));
      setMessages([...next, { role: "assistant", content: data.reply }]);
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
        onClick={() => setOpen(v => !v)}
        data-testid="button-public-chat-toggle"
        className={cn(
          "fixed bottom-5 right-5 z-[60] h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105",
          open && "scale-90",
        )}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open
          ? <X className="h-6 w-6" />
          : config.avatar
            ? <img src={config.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
            : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div
          className="fixed bottom-24 right-5 z-[60] w-[min(380px,calc(100vw-2.5rem))] h-[min(560px,calc(100vh-8rem))] rounded-xl border border-gray-200 bg-white shadow-2xl flex flex-col overflow-hidden"
          data-testid="public-chat-panel"
        >
          <div className="border-b p-3 flex items-center gap-2 bg-blue-50">
            {config.avatar
              ? <img src={config.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
              : <div className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">{config.name.charAt(0).toUpperCase()}</div>}
            <div className="font-semibold text-sm text-gray-900">{config.name}</div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "text-sm rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap break-words",
                  m.role === "user"
                    ? "ml-auto bg-blue-600 text-white"
                    : "bg-white border border-gray-200 text-gray-900",
                )}
                data-testid={`public-chat-message-${m.role}-${i}`}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="bg-white border border-gray-200 text-sm rounded-lg px-3 py-2 max-w-[85%] flex items-center gap-2 text-gray-700">
                <Loader2 className="h-3 w-3 animate-spin" />
                Typing…
              </div>
            )}
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2">{error}</div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="border-t p-2 flex gap-2 bg-white"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message…"
              disabled={loading}
              data-testid="input-public-chat-message"
              maxLength={2000}
              className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              data-testid="button-public-chat-send"
              className="px-3 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
