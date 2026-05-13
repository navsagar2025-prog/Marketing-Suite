import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { OnboardingFloatWidget } from "@/components/OnboardingChecklist";
import { CommandPalette } from "@/components/CommandPalette";
import { ChatWidget } from "@/components/ChatWidget";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { PromoBanner, PromoPopup } from "@/components/PromoSurfaces";
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
  Swords,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  Brain,
  AlertCircle,
  ShieldCheck,
  LogOut,
  Gauge,
  Activity,
  MessageSquare,
  BookOpen,
  HelpCircle,
  FlaskConical,
  FileBarChart,
  Send,
  MapPin,
  FileText,
  FolderOpen,
  Command,
  Package,
  Tag,
  Code2,
  MessageCircle,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useGetSettings, useGetMyUsage } from "@workspace/api-client-react";
import { useAuth, usePermissions } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationCenter";

type NavItem = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string | null;
  adminOnly?: boolean;
};

type NavGroup = {
  label: string | null;
  items: NavItem[];
  adminOnly?: boolean;
  collapsible?: boolean;
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { path: "/", label: "Dashboard", icon: LayoutDashboard, permission: null },
    ],
  },
  {
    label: "SEO Tools",
    collapsible: true,
    items: [
      { path: "/websites", label: "Websites", icon: Globe, permission: "websites" },
      { path: "/keywords", label: "Keywords", icon: Search, permission: "keywords" },
      { path: "/competitors", label: "Competitors", icon: Swords, permission: "keywords" },
      { path: "/local-seo", label: "Local SEO", icon: MapPin, permission: "keywords" },
      { path: "/content-brief", label: "Content Brief", icon: FileText, permission: "keywords" },
    ],
  },
  {
    label: "Marketing",
    collapsible: true,
    items: [
      { path: "/social", label: "Social Media", icon: Share2, permission: "social" },
      { path: "/calendar", label: "Calendar", icon: CalendarDays, permission: "calendar" },
      { path: "/campaigns", label: "Campaigns", icon: Megaphone, permission: "campaigns" },
      { path: "/backlinks", label: "Backlinks", icon: Link2, permission: "backlinks" },
      { path: "/outreach", label: "Outreach", icon: Send, permission: "backlinks" },
    ],
  },
  {
    label: "Leads & CRM",
    collapsible: true,
    items: [
      { path: "/leads", label: "Leads", icon: Users, permission: "leads" },
      { path: "/conversations", label: "Conversations", icon: MessageSquare, permission: "conversations" },
    ],
  },
  {
    label: "Analytics",
    collapsible: true,
    items: [
      { path: "/analytics", label: "Analytics", icon: BarChart3, permission: "analytics" },
      { path: "/utm-builder", label: "UTM Builder", icon: Link2, permission: "campaigns" },
      { path: "/ab-tests", label: "A/B Tests", icon: FlaskConical, permission: "analytics" },
      { path: "/reports", label: "Reports", icon: FileBarChart, permission: "analytics" },
    ],
  },
  {
    label: "AI & Media",
    collapsible: true,
    items: [
      { path: "/ai", label: "AI Tools", icon: Sparkles, permission: "ai_tools" },
      { path: "/media", label: "Media Library", icon: ImageIcon, permission: "media" },
    ],
  },
  {
    label: "Content",
    collapsible: true,
    items: [
      { path: "/blog", label: "Blog", icon: BookOpen, permission: null },
      { path: "/products", label: "Products", icon: Package, permission: null },
      { path: "/gallery", label: "Gallery", icon: ImageIcon, permission: null },
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    collapsible: true,
    items: [
      { path: "/admin", label: "Admin Panel", icon: ShieldCheck, permission: null, adminOnly: true },
      { path: "/admin/blog", label: "Blog Editor", icon: BookOpen, permission: null, adminOnly: true },
      { path: "/admin/catalog", label: "Catalog", icon: Package, permission: null, adminOnly: true },
      { path: "/admin/gallery", label: "Galleries", icon: ImageIcon, permission: null, adminOnly: true },
      { path: "/admin/promotions", label: "Promotions", icon: Tag, permission: null, adminOnly: true },
      { path: "/admin/seo-fill", label: "Bulk SEO Fill", icon: Wand2, permission: null, adminOnly: true },
      { path: "/admin/system-health", label: "System Health", icon: Activity, permission: null, adminOnly: true },
      { path: "/admin/live-traffic", label: "Live Traffic", icon: Activity, permission: null, adminOnly: true },
      { path: "/admin/site-code", label: "Site Code", icon: Code2, permission: "site_code" },
      { path: "/admin/chatbot", label: "Public Chatbot", icon: MessageCircle, permission: null, adminOnly: true },
    ],
  },
  {
    label: "Resources",
    collapsible: true,
    items: [
      { path: "/kb", label: "Knowledge Base", icon: HelpCircle, permission: null },
      { path: "/files", label: "Files", icon: FolderOpen, permission: null },
      { path: "/changelog", label: "Changelog", icon: Tag, permission: null },
      { path: "/settings", label: "Settings", icon: Settings, permission: null },
    ],
  },
];

const PAGE_TITLES: Array<[string, string]> = [
  ["/websites/", "Website Detail"],
  ["/reports/", "Report Detail"],
  ["/blog/", "Blog Post"],
  ["/products/", "Product"],
  ["/admin/catalog", "Catalog"],
  ["/admin/gallery", "Galleries"],
  ["/admin/promotions", "Promotions"],
  ["/products", "Products"],
  ["/gallery", "Gallery"],
  ["/kb/", "Knowledge Base"],
  ["/websites", "Websites"],
  ["/keywords", "Keywords"],
  ["/competitors", "Competitors"],
  ["/local-seo", "Local SEO"],
  ["/content-brief", "Content Brief"],
  ["/social", "Social Media"],
  ["/calendar", "Calendar"],
  ["/campaigns", "Campaigns"],
  ["/backlinks", "Backlinks"],
  ["/outreach", "Outreach"],
  ["/leads", "Leads"],
  ["/conversations", "Conversations"],
  ["/analytics", "Analytics"],
  ["/ai", "AI Tools"],
  ["/media", "Media Library"],
  ["/utm-builder", "UTM Builder"],
  ["/ab-tests", "A/B Tests"],
  ["/reports", "Reports"],
  ["/blog", "Blog"],
  ["/kb", "Knowledge Base"],
  ["/files", "Files"],
  ["/changelog", "Changelog"],
  ["/integrations", "Integrations"],
  ["/settings", "Settings"],
  ["/admin", "Admin Panel"],
  ["/", "Dashboard"],
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
      const saved = localStorage.getItem("theme");
      if (saved) return saved as "light" | "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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

function NavGroupSection({
  group,
  location,
  sidebarOpen,
  onNavClick,
  hasPermission,
  isAdmin,
}: {
  group: NavGroup;
  location: string;
  sidebarOpen: boolean;
  onNavClick?: () => void;
  hasPermission: (p: string) => boolean;
  isAdmin: boolean;
}) {
  const storageKey = `sidebar-collapsed-${group.label ?? "main"}`;
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(storageKey) === "true";
  });
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(storageKey, String(next));
  };

  const visibleItems = group.items.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.permission && item.permission !== null && !isAdmin && !hasPermission(item.permission)) return false;
    return true;
  });

  if (visibleItems.length === 0) return null;
  if (group.adminOnly && !isAdmin) return null;

  const hasActiveItem = visibleItems.some(item =>
    item.path === "/" ? location === "/" : location.startsWith(item.path)
  );

  return (
    <div className="mb-1">
      {group.label && sidebarOpen && (
        <button
          className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors"
          onClick={() => group.collapsible && toggleCollapsed()}
        >
          <span>{group.label}</span>
          {group.collapsible && (
            collapsed
              ? <ChevronRight className="h-3 w-3" />
              : <ChevronDown className="h-3 w-3" />
          )}
        </button>
      )}
      {group.label && !sidebarOpen && (
        <div className="mx-2 my-1 border-t border-sidebar-border/40" />
      )}
      {(!group.collapsible || !collapsed || hasActiveItem) && (
        <>
          {visibleItems.map(({ path, label, icon: Icon }) => {
            const active = path === "/" ? location === "/" : location.startsWith(path);
            const tourAttr =
              label === "Keywords" ? "nav-keywords"
              : label === "Campaigns" ? "nav-campaigns"
              : label === "Backlinks" ? "nav-backlinks"
              : undefined;
            return (
              <Link
                key={path}
                href={path}
                data-testid={`link-nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                {...(tourAttr ? { "data-tour": tourAttr } : {})}
                onClick={onNavClick}
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
        </>
      )}
    </div>
  );
}

function SidebarContent({
  navGroups,
  location,
  sidebarOpen,
  setSidebarOpen,
  onNavClick,
  onOpenCmd,
  settings,
  aiEnabled,
  providerLabel,
  aiProvider,
  usageData,
  theme,
  toggleTheme,
  user,
  logout,
  hasPermission,
}: {
  navGroups: NavGroup[];
  location: string;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  onNavClick?: () => void;
  onOpenCmd?: () => void;
  settings: ReturnType<typeof useGetSettings>["data"];
  aiEnabled: boolean;
  providerLabel: string;
  aiProvider: string;
  usageData: ReturnType<typeof useGetMyUsage>["data"];
  theme: "light" | "dark";
  toggleTheme: () => void;
  user: { username: string; role: string } | null;
  logout: () => void;
  hasPermission: (p: string) => boolean;
}) {
  const isAdmin = user?.role === "admin";

  return (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-sidebar-border">
        {sidebarOpen && (
          <span className="font-display font-bold text-base text-sidebar-foreground tracking-tight flex-1 truncate">
            SEO Command
          </span>
        )}
        {sidebarOpen && onOpenCmd && (
          <button
            onClick={onOpenCmd}
            title="Command palette (⌘K)"
            className="mr-1 hidden md:flex items-center px-1.5 py-0.5 rounded border border-sidebar-border/50 text-[10px] text-sidebar-foreground/40 hover:text-sidebar-foreground hover:border-sidebar-border transition-colors font-mono shrink-0"
          >
            ⌘K
          </button>
        )}
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-toggle-sidebar"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground shrink-0"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 py-2 overflow-y-auto" data-tour="sidebar-nav">
        {navGroups.map((group, idx) => (
          <NavGroupSection
            key={group.label ?? idx}
            group={group}
            location={location}
            sidebarOpen={sidebarOpen}
            onNavClick={onNavClick}
            hasPermission={hasPermission}
            isAdmin={isAdmin ?? false}
          />
        ))}
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

      {/* Footer: user info + notifications + theme toggle + logout */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        {sidebarOpen && user && (
          <p className="text-xs text-sidebar-foreground/60 px-1 truncate">
            Signed in as <span className="font-medium text-sidebar-foreground">{user.username}</span>
            {user.role === "admin" && (
              <span className="ml-1 text-[10px] text-primary font-semibold uppercase">admin</span>
            )}
          </p>
        )}
        <NotificationBell sidebarOpen={sidebarOpen} />
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
    </>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { data: settings } = useGetSettings();
  const { data: usageData } = useGetMyUsage();
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();

  const aiEnabled = settings?.aiEnabled ?? true;
  const aiProvider = settings?.aiProvider ?? "replit";
  const providerLabel = PROVIDER_SHORT[aiProvider] ?? aiProvider;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const match = PAGE_TITLES.find(([prefix]) =>
      prefix === "/" ? location === "/" : location.startsWith(prefix)
    );
    document.title = match ? `${match[1]} — SEO Command` : "SEO Command";
  }, [location]);

  const sharedSidebarProps = {
    navGroups: NAV_GROUPS,
    location,
    sidebarOpen,
    setSidebarOpen,
    onOpenCmd: () => setCmdOpen(true),
    settings,
    aiEnabled,
    providerLabel,
    aiProvider,
    usageData,
    theme,
    toggleTheme,
    user,
    logout,
    hasPermission,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background flex-col">
      <ImpersonationBanner />
      <PromoBanner audience="loggedIn" />
      <PromoPopup audience="loggedIn" />
    <div className="flex flex-1 overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        data-testid="sidebar"
        className={cn(
          "hidden md:flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200",
          sidebarOpen ? "w-56" : "w-14"
        )}
      >
        <SidebarContent {...sharedSidebarProps} />
      </aside>

      {/* Mobile Sheet nav */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar text-sidebar-foreground border-sidebar-border flex flex-col">
          <SidebarContent
            {...sharedSidebarProps}
            sidebarOpen={true}
            setSidebarOpen={() => {}}
            onNavClick={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-2 px-3 h-12 border-b bg-background shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-display font-bold text-sm flex-1">SEO Command</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCmdOpen(true)}
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
        </header>

        {/* Cmd+K hint — desktop only, shown in collapsed sidebar */}
        {!sidebarOpen && (
          <button
            className="hidden md:flex absolute bottom-24 left-1 z-10 w-12 justify-center text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
            onClick={() => setCmdOpen(true)}
            title="Command palette (⌘K)"
          >
            <Command className="h-4 w-4" />
          </button>
        )}

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Command palette */}
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />

      {/* Floating onboarding checklist — visible on all pages except the dashboard */}
      {location !== "/" && <OnboardingFloatWidget />}

      {/* Floating AI chat assistant */}
      <ChatWidget />
    </div>
    </div>
  );
}
