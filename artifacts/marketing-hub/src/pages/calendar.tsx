import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useListSocialPosts } from "@workspace/api-client-react";
import type { SocialPost } from "@workspace/api-client-react";
import { MessageCircle, Camera, Twitter, Briefcase, Youtube } from "lucide-react";

const PLATFORMS: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  facebook: { label: "Facebook", color: "bg-blue-500", Icon: MessageCircle },
  instagram: { label: "Instagram", color: "bg-pink-500", Icon: Camera },
  twitter: { label: "Twitter/X", color: "bg-sky-500", Icon: Twitter },
  linkedin: { label: "LinkedIn", color: "bg-indigo-500", Icon: Briefcase },
  youtube: { label: "YouTube", color: "bg-red-500", Icon: Youtube },
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function PostPill({ post }: { post: SocialPost }) {
  const platform = PLATFORMS[post.platform] ?? { label: post.platform, color: "bg-gray-500", Icon: CalendarIcon };
  const { Icon } = platform;
  return (
    <div className={`${platform.color} text-white text-xs rounded px-1.5 py-0.5 flex items-center gap-1 truncate`}>
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{post.content.slice(0, 20)}{post.content.length > 20 ? "…" : ""}</span>
    </div>
  );
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);

  const { data: posts, isLoading } = useListSocialPosts();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const postsByDay: Record<string, SocialPost[]> = {};
  (posts ?? []).forEach(post => {
    const dateStr = post.scheduledAt
      ? new Date(post.scheduledAt).toDateString()
      : null;
    if (dateStr) {
      if (!postsByDay[dateStr]) postsByDay[dateStr] = [];
      postsByDay[dateStr].push(post);
    }
  });

  const monthLabel = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const selectedDayPosts = selectedDate
    ? (postsByDay[new Date(selectedDate).toDateString()] ?? [])
    : [];

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Content Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Scheduled social posts across all platforms</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} data-testid="button-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center" data-testid="text-month-label">{monthLabel}</span>
          <Button variant="outline" size="icon" onClick={nextMonth} data-testid="button-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Platform legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(PLATFORMS).map(([key, { label, color, Icon }]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Calendar grid */}
            <div className="grid grid-cols-7 border-b">
              {DAYS.map(d => (
                <div key={d} className="text-xs font-medium text-muted-foreground py-2 text-center">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {/* Empty cells for first day offset */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[90px] border-r border-b last:border-r-0 bg-muted/20" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const day = idx + 1;
                const dayDate = new Date(year, month, day);
                const dayKey = dayDate.toDateString();
                const dayPosts = postsByDay[dayKey] ?? [];
                const isToday = dayDate.toDateString() === now.toDateString();
                const isPast = dayDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());

                return (
                  <div
                    key={day}
                    data-testid={`calendar-day-${day}`}
                    className={`min-h-[90px] border-r border-b last:border-r-0 p-1.5 cursor-pointer hover:bg-muted/30 transition-colors ${isPast ? "bg-muted/10" : ""}`}
                    onClick={() => { if (dayPosts.length > 0) setSelectedDate(dayDate.toISOString()); }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                        {day}
                      </span>
                      {dayPosts.length > 2 && (
                        <span className="text-xs text-muted-foreground">+{dayPosts.length - 2}</span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {dayPosts.slice(0, 2).map(post => (
                        <div
                          key={post.id}
                          onClick={e => { e.stopPropagation(); setSelectedPost(post); }}
                        >
                          <PostPill post={post} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unscheduled posts info */}
      {!isLoading && (posts ?? []).filter(p => !p.scheduledAt).length > 0 && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <CalendarIcon className="h-3.5 w-3.5" />
          {(posts ?? []).filter(p => !p.scheduledAt).length} posts without a scheduled date are not shown on this calendar.
        </div>
      )}

      {/* Day detail dialog */}
      <Dialog open={!!selectedDate && !selectedPost} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">
              {selectedDate ? formatDate(new Date(selectedDate)) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {selectedDayPosts.map(post => {
              const platform = PLATFORMS[post.platform] ?? { label: post.platform, color: "bg-gray-500", Icon: CalendarIcon };
              const { Icon } = platform;
              return (
                <div
                  key={post.id}
                  className="border rounded-md p-3 cursor-pointer hover:bg-muted/30"
                  onClick={() => { setSelectedPost(post); setSelectedDate(null); }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`${platform.color} text-white rounded px-1.5 py-0.5 flex items-center gap-1 text-xs`}>
                      <Icon className="h-3 w-3" />
                      <span>{platform.label}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{post.status}</Badge>
                  </div>
                  <p className="text-sm line-clamp-2">{post.content}</p>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Post detail dialog */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent>
          {selectedPost && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm flex items-center gap-2">
                  {(() => {
                    const platform = PLATFORMS[selectedPost.platform] ?? { label: selectedPost.platform, color: "bg-gray-500", Icon: CalendarIcon };
                    const { Icon } = platform;
                    return (
                      <div className={`${platform.color} text-white rounded px-2 py-0.5 flex items-center gap-1 text-xs`}>
                        <Icon className="h-3 w-3" />
                        <span>{platform.label}</span>
                      </div>
                    );
                  })()}
                  <Badge variant="outline" className="text-xs">{selectedPost.status}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm whitespace-pre-wrap">{selectedPost.content}</p>
                {selectedPost.scheduledAt && (
                  <p className="text-xs text-muted-foreground">
                    Scheduled: {new Date(selectedPost.scheduledAt).toLocaleString()}
                  </p>
                )}
                {selectedPost.mediaUrl && (
                  <img src={selectedPost.mediaUrl} alt="Media" className="rounded-md max-h-48 object-contain border w-full" />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
