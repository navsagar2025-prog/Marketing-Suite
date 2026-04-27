import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, X, Loader2, BookCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateConversation,
  useGetConversationMessages,
  useSendMessage,
  useSummarizeConversation,
  getGetConversationMessagesQueryKey,
  getListLeadsQueryKey,
} from "@workspace/api-client-react";
import type { Conversation, ConversationMessage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ConversationDrawerProps {
  leadId: number;
  leadName: string;
  existingConversation?: Conversation | null;
  onClose: () => void;
  onConversationCreated?: (conv: Conversation) => void;
}

function MessageBubble({ msg }: { msg: ConversationMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2 mb-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <MessageSquare className="h-3 w-3 text-primary" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm"
        )}
      >
        {msg.content}
      </div>
    </div>
  );
}

export default function ConversationDrawer({
  leadId,
  leadName,
  existingConversation,
  onClose,
  onConversationCreated,
}: ConversationDrawerProps) {
  const [conversationId, setConversationId] = useState<number | null>(
    existingConversation?.id ?? null
  );
  const [input, setInput] = useState("");
  const [initializing, setInitializing] = useState(!existingConversation);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();
  const summarize = useSummarizeConversation();

  const { data: msgs, isLoading: msgsLoading } = useGetConversationMessages(
    conversationId ?? 0,
    { query: { enabled: conversationId != null } }
  );

  useEffect(() => {
    if (!existingConversation) {
      createConversation.mutate(
        { data: { title: `Qualify: ${leadName}`, leadId } },
        {
          onSuccess: (conv) => {
            setConversationId(conv.id);
            setInitializing(false);
            onConversationCreated?.(conv);
          },
          onError: () => {
            toast({ title: "Failed to start conversation", variant: "destructive" });
            onClose();
          },
        }
      );
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    if (!initializing && !msgsLoading) {
      inputRef.current?.focus();
    }
  }, [initializing, msgsLoading]);

  const handleSend = () => {
    if (!input.trim() || !conversationId || sendMessage.isPending) return;
    const content = input.trim();
    setInput("");
    sendMessage.mutate(
      { id: conversationId, data: { content } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetConversationMessagesQueryKey(conversationId) });
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Failed to send message";
          toast({ title: msg, variant: "destructive" });
          setInput(content);
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveToLead = () => {
    if (!conversationId) return;
    summarize.mutate(
      { id: conversationId },
      {
        onSuccess: (data) => {
          if (data.notesSaved) {
            queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
            toast({ title: "Qualification notes saved to lead" });
          } else {
            toast({ title: "No linked lead — notes not saved", description: data.summary, variant: "destructive" });
          }
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Failed to summarize conversation";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const isLoading = initializing || msgsLoading;
  const messages: ConversationMessage[] = msgs ?? [];

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-[420px] max-w-full bg-background border-l shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div>
          <p className="font-semibold text-sm">Qualify Lead</p>
          <p className="text-xs text-muted-foreground">{leadName}</p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && leadId > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleSaveToLead}
              disabled={summarize.isPending}
              data-testid="button-save-to-lead"
              title="Generate AI summary and save to lead notes"
            >
              {summarize.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <BookCheck className="h-3 w-3" />
              )}
              Save to Lead
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-3/4 rounded-2xl" />
            <Skeleton className="h-10 w-1/2 ml-auto rounded-2xl" />
            <Skeleton className="h-14 w-4/5 rounded-2xl" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pb-8">
            <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm font-medium">Start qualifying {leadName}</p>
            <p className="text-xs mt-1 max-w-xs">
              Send a message to begin the AI-assisted qualification conversation.
            </p>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} />
            ))}
            {sendMessage.isPending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>AI is responding...</span>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t bg-muted/10">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={isLoading || sendMessage.isPending || !conversationId}
            className="flex-1"
            data-testid="input-chat-message"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading || sendMessage.isPending || !conversationId}
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 text-center">Press Enter to send</p>
      </div>
    </div>
  );
}
