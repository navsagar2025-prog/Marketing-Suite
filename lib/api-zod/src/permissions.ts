export const ALL_MODULES = [
  "websites",
  "keywords",
  "leads",
  "campaigns",
  "backlinks",
  "social",
  "analytics",
  "ai_tools",
  "media",
  "calendar",
  "conversations",
] as const;

export type PermissionModule = (typeof ALL_MODULES)[number];

export const MODULE_LABELS: Record<PermissionModule, string> = {
  websites: "Websites",
  keywords: "Keywords",
  leads: "Leads",
  campaigns: "Campaigns",
  backlinks: "Backlinks",
  social: "Social Media",
  analytics: "Analytics",
  ai_tools: "AI Tools",
  media: "Media Library",
  calendar: "Calendar",
  conversations: "Conversations",
};
