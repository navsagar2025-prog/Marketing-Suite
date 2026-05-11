import { useState, useRef, useEffect } from "react";
import { Bell, BellRing, Users, TrendingUp, CheckCircle2, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

type Notification = {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  time: string;
  read: boolean;
};

const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    icon: <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />,
    iconBg: "bg-emerald-500/15",
    title: "3 new leads captured",
    subtitle: "From your homepage lead form",
    time: "2 min ago",
    read: false,
  },
  {
    id: "2",
    icon: <TrendingUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />,
    iconBg: "bg-blue-500/15",
    title: "Keyword ranking improved",
    subtitle: '"seo tool" moved to position #4',
    time: "1 hr ago",
    read: false,
  },
];

export function NotificationBell({ sidebarOpen }: { sidebarOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(DEMO_NOTIFICATIONS);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.read).length;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const dismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size={sidebarOpen ? "sm" : "icon"}
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground relative",
          !sidebarOpen && "justify-center"
        )}
        aria-label="Notifications"
      >
        <span className="relative shrink-0">
          {unread > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none">
              {unread}
            </span>
          )}
        </span>
        {sidebarOpen && <span className="ml-2">Notifications</span>}
        {sidebarOpen && unread > 0 && (
          <span className="ml-auto h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
            {unread}
          </span>
        )}
      </Button>

      {open && (
        <div
          className={cn(
            "absolute z-50 w-72 rounded-lg border bg-popover shadow-xl",
            sidebarOpen
              ? "left-full ml-2 bottom-0"
              : "left-full ml-2 bottom-0"
          )}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b">
            <span className="text-sm font-semibold">Notifications</span>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Mark all read
                </button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {notifications.length > 0 ? (
            <div className="divide-y max-h-72 overflow-y-auto">
              {notifications.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 px-3 py-3 hover:bg-muted/50 transition-colors",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <div className={cn("mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0", n.iconBg)}>
                    {n.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs leading-snug", !n.read ? "font-semibold" : "font-medium")}>
                      {n.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{n.subtitle}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{n.time}</p>
                  </div>
                  <button
                    onClick={() => dismiss(n.id)}
                    className="text-muted-foreground/40 hover:text-muted-foreground shrink-0 mt-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <CheckCircle2 className="h-7 w-7 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">You're all caught up!</p>
            </div>
          )}

          <div className="border-t px-3 py-2">
            <Link
              href="/settings"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
              onClick={() => setOpen(false)}
            >
              <Settings className="h-3.5 w-3.5" />
              Notification settings
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
