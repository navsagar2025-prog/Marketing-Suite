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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/websites", label: "Websites", icon: Globe },
  { path: "/keywords", label: "Keywords", icon: Search },
  { path: "/social", label: "Social Media", icon: Share2 },
  { path: "/calendar", label: "Calendar", icon: CalendarDays },
  { path: "/campaigns", label: "Campaigns", icon: Megaphone },
  { path: "/backlinks", label: "Backlinks", icon: Link2 },
  { path: "/leads", label: "Leads", icon: Users },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/ai", label: "AI Tools", icon: Sparkles },
  { path: "/media", label: "Media Library", icon: ImageIcon },
  { path: "/settings", label: "Settings", icon: Settings },
];

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
          {navItems.map(({ path, label, icon: Icon }) => {
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

        {/* Theme toggle */}
        <div className="p-2 border-t border-sidebar-border">
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
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
