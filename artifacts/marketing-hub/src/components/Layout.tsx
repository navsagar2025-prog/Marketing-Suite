import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Globe,
  Search,
  Share2,
  Megaphone,
  Link2,
  Users,
  BarChart3,
  Sparkles,
  ImageIcon,
  Settings,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight,
  CalendarDays,
  Brain,
  AlertCircle,
  ShieldCheck,
  LogOut,
  Gauge,
  MessageSquare,
  BookOpen,
  HelpCircle,
  FlaskConical,
  FileBarChart,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useGetSettings, useGetMyUsage } from "@workspace/api-client-react";
import { useAuth, usePermissions } from "@/contexts/AuthContext";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, permission: null },
  { path: "/websites", label: "Websites", icon: Globe, permission: "websites" },
  { path: "/keywords", label: "Keywords", icon: Search, permission: "keywords" },
  { path: "/social", label: "Social Media", icon: Share2, permission: "social" },
  { path: "/calendar", label: "Calendar", icon: CalendarDays, permission: "calendar" },
  { path: "/campaigns", label: "Campaigns", icon: Megaphone, permission: "campaigns" },
  { path: "/backlinks", label: "Backlinks", icon: Link2, permission: "backlinks" },
  { path: "/outreach", label: "Outreach", icon: Send, permission: "backlinks" },
  { path: "/leads", label: "Leads", icon: Users, permission: "leads" },
  { path: "/conversations", label: "Conversations", icon: MessageSquare, permission: "conversations" },
  { path: "/analytics", label: "Analytics", icon: BarChart3, permission: "analytics" },
  { path: "/ai", label: "AI Tools", icon: Sparkles, permission: "ai_tools" },
  { path: "/media", label: "Media Library", icon: ImageIcon, permission: "media" },
  { path: "/utm-builder", label: "UTM Builder", icon: Link2, permission: "campaigns" },
  { path: "/ab-tests", label: "A/B Tests", icon: FlaskConical, permission: "analytics" },
  { path: "/reports", label: "Reports", icon: FileBarChart, permission: "analytics" },
  { path: "/blog", label: "Blog", icon: BookOpen, permission: null },
  { path: "/kb", label: "Knowledge Base", icon: HelpCircle, permission: null },
  { path: "/settings", label: "Settings", icon: Settings, permission: null },
];

const PROVIDER_SHORT: Record<string, string> = {
  replit: "Replit",
  openai: "OpenAI",
  anthropic: "Claude",
  perplexity: "Perplexity",
  gemini: "Gemini",
};

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as "light" | "dark") || "light";
    }
    return "light";
  });

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  if (typeof window !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }

  return { theme, toggleTheme };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const { data: settings } = useGetSettings();
  const { data: usageData } = useGetMyUsage();
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();

  const aiEnabled = settings?.aiEnabled ?? true;
  const aiProvider = settings?.aiProvider ?? "replit";
  const providerLabel = PROVIDER_SHORT[aiProvider] ?? aiProvider;

  const visibleNavItems = navItems.filter(item =>
    item.permission == null || hasPermission(item.permission)
  );

  const allNavItems = [
    ...visibleNavItems,
    ...(user?.role === "admin" ? [{ path: "/admin", label: "Admin", icon: ShieldCheck, permission: null }] : []),
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className={cn(
          "flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200",
          sidebarOpen ? "w-56" : "w-14"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-3 py-4 border-b border-sidebar-border">
          {sidebarOpen && (
            <span className="font-display font-bold text-base text-sidebar-foreground tracking-tight">
              SEO Command
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-toggle-sidebar"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ml-auto"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {allNavItems.map(({ path, label, icon: Icon }) => {
            const active = location === path || (path !== "/" && location.startsWith(path));
            return (
              <Link
                key={path}
                href={path}
                data-testid={`link-nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 mx-1 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && <span className="truncate">{label}</span>}
                {sidebarOpen && active && <ChevronRight className="h-3 w-3 ml-auto shrink-0 opacity-70" />}
              </Link>
            );
          })}
        </nav>

        {/* AI Usage widget */}
        {sidebarOpen && usageData?.summary && usageData.summary.length > 0 && (
          <div className="px-3 pb-1">
            <Link href="/settings">
              <div
                data-testid="ai-usage-widget"
                className="rounded-md bg-sidebar-accent/40 px-2 py-2 text-xs cursor-pointer hover:bg-sidebar-accent/70 transition-colors space-y-1.5"
              >
                <div className="flex items-center gap-1.5 text-sidebar-foreground/70 font-medium">
                  <Gauge className="h-3 w-3 shrink-0" />
                  <span>AI Usage this month</span>
                </div>
                {usageData.summary.map(entry => {
                  const pct = entry.limit > 0 ? Math.min(100, Math.round((entry.used / entry.limit) * 100)) : 0;
                  const isNear = pct >= 80;
                  const isExhausted = pct >= 100;
                  return (
                    <div key={entry.type} className="space-y-0.5">
                      <div className="flex justify-between text-sidebar-foreground/60">
                        <span className="capitalize">{entry.type}</span>
                        <span className={cn(isExhausted ? "text-destructive font-semibold" : isNear ? "text-amber-500" : "")}>
                          {entry.used}/{entry.limit}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-sidebar-border overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isExhausted ? "bg-destructive" : isNear ? "bg-amber-400" : "bg-primary/60"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Link>
          </div>
        )}

        {/* AI status badge */}
        {sidebarOpen && settings !== undefined && (
          <div className="px-3 pb-2">
            <Link href="/settings">
              <div
                data-testid="ai-provider-badge"
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors",
                  aiEnabled
                    ? "bg-sidebar-accent/60 text-sidebar-foreground hover:bg-sidebar-accent"
                    : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                )}
              >
                {aiEnabled
                  ? <Brain className="h-3.5 w-3.5 shrink-0" />
                  : <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                }
                <span className="truncate font-medium flex-1">
                  {aiEnabled ? `AI: ${providerLabel}` : "AI: Disabled"}
                </span>
                <span
                  data-testid="ai-connectivity-dot"
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    !aiEnabled
                      ? "bg-muted-foreground/40"
                      : (aiProvider === "replit" || settings?.aiApiKeyConfigured)
                        ? "bg-green-400"
                        : "bg-amber-400"
                  )}
                  title={
                    !aiEnabled
                      ? "AI disabled"
                      : (aiProvider === "replit" || settings?.aiApiKeyConfigured)
                        ? "AI configured and ready"
                        : "API key not configured"
                  }
                />
              </div>
            </Link>
          </div>
        )}

        {/* Footer: user info + theme toggle + logout */}
        <div className="p-2 border-t border-sidebar-border space-y-1">
          {sidebarOpen && user && (
            <p className="text-xs text-sidebar-foreground/60 px-1 truncate">
              Signed in as <span className="font-medium text-sidebar-foreground">{user.username}</span>
            </p>
          )}
          <Button
            variant="ghost"
            size={sidebarOpen ? "sm" : "icon"}
            data-testid="button-toggle-theme"
            className="w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={toggleTheme}
          >
            {theme === "light" ? <Moon className="h-4 w-4 shrink-0" /> : <Sun className="h-4 w-4 shrink-0" />}
            {sidebarOpen && <span className="ml-2">{theme === "light" ? "Dark Mode" : "Light Mode"}</span>}
          </Button>
          <Button
            variant="ghost"
            size={sidebarOpen ? "sm" : "icon"}
            data-testid="button-logout"
            className="w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span className="ml-2">Sign out</span>}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
