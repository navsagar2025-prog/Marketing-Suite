import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  CalendarDays,
  FileBarChart,
  Send,
  MapPin,
  FileText,
  ShieldCheck,
  FlaskConical,
  BookOpen,
  HelpCircle,
  MessageSquare,
  Swords,
} from "lucide-react";

const NAV_COMMANDS = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, group: "Navigation" },
  { label: "Websites", path: "/websites", icon: Globe, group: "Navigation" },
  { label: "Keywords", path: "/keywords", icon: Search, group: "Navigation" },
  { label: "Competitors", path: "/competitors", icon: Swords, group: "Navigation" },
  { label: "Social Media", path: "/social", icon: Share2, group: "Navigation" },
  { label: "Campaigns", path: "/campaigns", icon: Megaphone, group: "Navigation" },
  { label: "Backlinks", path: "/backlinks", icon: Link2, group: "Navigation" },
  { label: "Outreach", path: "/outreach", icon: Send, group: "Navigation" },
  { label: "Leads", path: "/leads", icon: Users, group: "Navigation" },
  { label: "Conversations", path: "/conversations", icon: MessageSquare, group: "Navigation" },
  { label: "Analytics", path: "/analytics", icon: BarChart3, group: "Navigation" },
  { label: "AI Tools", path: "/ai", icon: Sparkles, group: "Tools" },
  { label: "Content Brief", path: "/content-brief", icon: FileText, group: "Tools" },
  { label: "Local SEO", path: "/local-seo", icon: MapPin, group: "Tools" },
  { label: "UTM Builder", path: "/utm-builder", icon: Link2, group: "Tools" },
  { label: "A/B Tests", path: "/ab-tests", icon: FlaskConical, group: "Tools" },
  { label: "Reports", path: "/reports", icon: FileBarChart, group: "Tools" },
  { label: "Media Library", path: "/media", icon: ImageIcon, group: "Tools" },
  { label: "Calendar", path: "/calendar", icon: CalendarDays, group: "Tools" },
  { label: "Blog", path: "/blog", icon: BookOpen, group: "Resources" },
  { label: "Knowledge Base", path: "/kb", icon: HelpCircle, group: "Resources" },
  { label: "Settings", path: "/settings", icon: Settings, group: "Account" },
  { label: "Admin Panel", path: "/admin", icon: ShieldCheck, group: "Account" },
];

const GROUPS = ["Navigation", "Tools", "Resources", "Account"];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [, setLocation] = useLocation();

  const navigate = (path: string) => {
    setLocation(path);
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Go to a page or tool..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {GROUPS.map((group) => {
          const items = NAV_COMMANDS.filter((c) => c.group === group);
          return (
            <CommandGroup key={group} heading={group}>
              {items.map((cmd) => (
                <CommandItem
                  key={cmd.path}
                  value={cmd.label}
                  onSelect={() => navigate(cmd.path)}
                >
                  <cmd.icon className="mr-2 h-4 w-4 shrink-0" />
                  {cmd.label}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
