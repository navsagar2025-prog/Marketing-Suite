import { useState } from "react";
import { MessageSquare, Users, Clock } from "lucide-react";
import { useListConversations, getListConversationsQueryKey } from "@workspace/api-client-react";
import type { Conversation } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import ConversationDrawer from "@/components/ConversationDrawer";

function formatRelativeTime(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Conversations() {
  const { data: conversations, isLoading } = useListConversations();
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const queryClient = useQueryClient();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display" data-testid="text-conversations-title">Conversations</h1>
        <p className="text-sm text-muted-foreground mt-0.5">AI-assisted lead qualification conversations</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : !conversations || conversations.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start qualifying leads from the Leads page</p>
            </div>
          ) : (
            <div className="divide-y">
              {conversations.map((conv: Conversation) => {
                const lastActivity = conv.lastMessageAt ?? conv.createdAt;
                const relativeTime = formatRelativeTime(lastActivity);
                return (
                  <button
                    key={conv.id}
                    data-testid={`row-conversation-${conv.id}`}
                    onClick={() => setActiveConversation(conv)}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {conv.leadName ? (
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {conv.leadName}
                          </span>
                        ) : (
                          "No lead linked"
                        )}
                      </p>
                    </div>
                    {relativeTime && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                        <Clock className="h-3 w-3" />
                        {relativeTime}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {activeConversation && (
        <ConversationDrawer
          leadId={activeConversation.leadId ?? 0}
          leadName={activeConversation.leadName ?? activeConversation.title}
          existingConversation={activeConversation}
          onClose={() => setActiveConversation(null)}
          onConversationCreated={() => {
            queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          }}
        />
      )}
    </div>
  );
}
