import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Plus, ShieldCheck, Users, Activity, BarChart2, AlertTriangle, ArrowUpDown, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ALL_MODULES as MODULE_KEYS, MODULE_LABELS } from "@workspace/api-zod";

const DAILY_LIMIT = 2;

const ALL_MODULES = MODULE_KEYS.map(key => ({ key, label: MODULE_LABELS[key] }));

interface AuditRequest {
  id: number;
  ip: string;
  url: string | null;
  date: string;
  count: number;
  lastRequestAt: string;
}

interface AllowlistEntry {
  id: number;
  ip: string;
  note: string | null;
  createdAt: string;
}

interface StaffUser {
  id: number;
  username: string;
  role: "admin" | "staff";
  permissions: string[] | null;
  createdAt: string;
}

interface VisitorStats {
  uniqueIpsToday: number;
  totalRequestsToday: number;
  totalRequestsAllTime: number;
  ipsAtLimitToday: number;
  dailyData: { date: string; requests: number }[];
}

function useApiHeaders() {
  const { token } = useAuth();
  return { Authorization: `Bearer ${token}` };
}

function useAdminFetch<T>(queryKey: string[], path: string) {
  const headers = useApiHeaders();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return useQuery<T>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`${base}${path}`, { headers });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
}

type SortField = "ip" | "date" | "count" | "lastRequestAt";
type SortDir = "asc" | "desc";

function VisitorsTab() {
  const { data: stats, isLoading: statsLoading } = useAdminFetch<VisitorStats>(
    ["admin-visitor-stats"],
    "/api/admin/visitor-stats"
  );
  const { data: requests, isLoading: requestsLoading } = useAdminFetch<AuditRequest[]>(
    ["admin-audit-requests"],
    "/api/admin/audit-requests"
  );

  const [dateFilter, setDateFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("lastRequestAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const filteredAndSorted = useMemo(() => {
    if (!requests) return [];
    let rows = [...requests];
    if (dateFilter) {
      rows = rows.filter(r => r.date === dateFilter);
    }
    rows.sort((a, b) => {
      let av: string | number = a[sortField] ?? "";
      let bv: string | number = b[sortField] ?? "";
      if (sortField === "count") {
        av = Number(av);
        bv = Number(bv);
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [requests, dateFilter, sortField, sortDir]);

  const chartData = useMemo(() => {
    if (!stats?.dailyData) return [];
    return stats.dailyData.map(d => ({
      ...d,
      label: d.date.slice(5),
    }));
  }, [stats]);

  const statCards = [
    {
      title: "Unique IPs Today",
      value: stats?.uniqueIpsToday ?? 0,
      icon: <Users className="h-4 w-4 text-muted-foreground" />,
    },
    {
      title: "Audits Today",
      value: stats?.totalRequestsToday ?? 0,
      icon: <Activity className="h-4 w-4 text-muted-foreground" />,
    },
    {
      title: "All-Time Audits",
      value: stats?.totalRequestsAllTime ?? 0,
      icon: <BarChart2 className="h-4 w-4 text-muted-foreground" />,
    },
    {
      title: "IPs at Limit Today",
      value: stats?.ipsAtLimitToday ?? 0,
      icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
      highlight: (stats?.ipsAtLimitToday ?? 0) > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map(card => (
          <Card key={card.title} className={card.highlight ? "border-destructive/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
              {card.icon}
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <p className={`text-2xl font-bold ${card.highlight ? "text-destructive" : ""}`}>
                  {card.value.toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit Volume — Last 14 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(v: number) => [v, "Audits"]}
                  labelFormatter={label => `Date: ${label}`}
                />
                <Bar dataKey="requests" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Recent Visitor Activity</CardTitle>
          <Input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="w-auto text-xs h-8"
          />
        </CardHeader>
        <CardContent>
          {requestsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-2 font-medium">
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort("ip")}
                      >
                        IP <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-left py-2 font-medium">Last Audited URL</th>
                    <th className="text-left py-2 font-medium">
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort("date")}
                      >
                        Date <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-right py-2 font-medium">
                      <button
                        className="flex items-center gap-1 hover:text-foreground ml-auto"
                        onClick={() => handleSort("count")}
                      >
                        Requests <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-left py-2 font-medium">
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort("lastRequestAt")}
                      >
                        Last Seen <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSorted.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-muted-foreground">No records found.</td>
                    </tr>
                  ) : filteredAndSorted.map(r => {
                    const hitLimit = r.count >= DAILY_LIMIT;
                    return (
                      <tr
                        key={r.id}
                        className={`border-b last:border-0 hover:bg-muted/30 ${hitLimit ? "bg-destructive/5" : ""}`}
                      >
                        <td className="py-2 font-mono">{r.ip}</td>
                        <td className="py-2 max-w-[180px] truncate text-muted-foreground">{r.url ?? "—"}</td>
                        <td className="py-2">{r.date}</td>
                        <td className="py-2 text-right">{r.count}</td>
                        <td className="py-2 text-muted-foreground">{new Date(r.lastRequestAt).toLocaleString()}</td>
                        <td className="py-2">
                          {hitLimit ? (
                            <Badge variant="destructive" className="text-xs">Limit Hit</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Active</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AllowlistTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { token } = useAuth();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const { data, isLoading } = useAdminFetch<AllowlistEntry[]>(["admin-allowlist"], "/api/admin/allowlist");

  const [ipInput, setIpInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${base}/api/admin/allowlist`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ip: ipInput, note: noteInput }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-allowlist"] });
      setIpInput("");
      setNoteInput("");
      toast({ title: "IP added to allowlist" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${base}/api/admin/allowlist/${id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-allowlist"] });
      toast({ title: "Entry removed" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Add IP to Allowlist</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="IP address (e.g. 203.0.113.1)"
              value={ipInput}
              onChange={e => setIpInput(e.target.value)}
              className="flex-1 min-w-0"
            />
            <Input
              placeholder="Note (optional)"
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              className="flex-1 min-w-0"
            />
            <Button onClick={() => addMutation.mutate()} disabled={!ipInput || addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Add</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Allowlisted IPs</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">No IPs allowlisted yet.</p>
          ) : (
            <div className="space-y-2">
              {data.map(entry => (
                <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-mono font-medium">{entry.ip}</p>
                    {entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(entry.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModuleChecklist({
  selected,
  onChange,
  fullAccess,
  onFullAccessChange,
  idPrefix = "perm",
  disabled = false,
}: {
  selected: string[];
  onChange: (keys: string[]) => void;
  fullAccess: boolean;
  onFullAccessChange: (v: boolean) => void;
  idPrefix?: string;
  disabled?: boolean;
}) {
  function toggle(key: string) {
    if (disabled) return;
    if (selected.includes(key)) {
      onChange(selected.filter(k => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  return (
    <div className={`space-y-2 ${disabled ? "opacity-60" : ""}`}>
      <label className={`flex items-center gap-2 select-none ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`} htmlFor={`${idPrefix}-full-access`}>
        <input
          type="checkbox"
          id={`${idPrefix}-full-access`}
          checked={disabled ? true : fullAccess}
          onChange={e => !disabled && onFullAccessChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border border-input cursor-pointer"
        />
        <span className="text-sm font-medium">Full access (all modules)</span>
      </label>
      {!disabled && !fullAccess && (
        <div className="grid grid-cols-2 gap-1 pt-1 pl-1">
          {ALL_MODULES.map(m => (
            <label key={m.key} className="flex items-center gap-2 cursor-pointer select-none py-0.5" htmlFor={`${idPrefix}-mod-${m.key}`}>
              <input
                type="checkbox"
                id={`${idPrefix}-mod-${m.key}`}
                checked={selected.includes(m.key)}
                onChange={() => toggle(m.key)}
                className="h-4 w-4 rounded border border-input cursor-pointer"
              />
              <span className="text-xs">{m.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function StaffTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { token, user: currentUser } = useAuth();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const { data, isLoading } = useAdminFetch<StaffUser[]>(["admin-staff"], "/api/admin/staff");

  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [roleInput, setRoleInput] = useState<"staff" | "admin">("staff");
  const [newUserFullAccess, setNewUserFullAccess] = useState(true);
  const [newUserPermissions, setNewUserPermissions] = useState<string[]>([]);

  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editFullAccess, setEditFullAccess] = useState(true);

  function openPermissionsPanel(staff: StaffUser) {
    if (expandedUserId === staff.id) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(staff.id);
    const hasFullAccess = staff.permissions == null;
    setEditFullAccess(hasFullAccess);
    setEditPermissions(hasFullAccess ? [] : (staff.permissions ?? []));
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      const permissions = roleInput === "admin" ? null : (newUserFullAccess ? null : newUserPermissions);
      const res = await fetch(`${base}/api/admin/staff`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          username: usernameInput,
          password: passwordInput,
          role: roleInput,
          permissions,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-staff"] });
      setUsernameInput("");
      setPasswordInput("");
      setRoleInput("staff");
      setNewUserFullAccess(true);
      setNewUserPermissions([]);
      toast({ title: "Staff account created" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ id, permissions }: { id: number; permissions: string[] | null }) => {
      const res = await fetch(`${base}/api/admin/users/${id}/permissions`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-staff"] });
      setExpandedUserId(null);
      toast({ title: "Permissions updated" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${base}/api/admin/staff/${id}`, { method: "DELETE", headers });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-staff"] });
      toast({ title: "Staff account removed" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  function permissionsSummary(staff: StaffUser) {
    if (staff.role === "admin") return "Full access (admin)";
    if (staff.permissions == null) return "Full access";
    if (staff.permissions.length === 0) return "No modules";
    return `${staff.permissions.length} module${staff.permissions.length !== 1 ? "s" : ""}`;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Staff Account</CardTitle>
          <p className="text-xs text-muted-foreground">Permission changes take effect the next time a staff member logs in.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Username"
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)}
              className="flex-1 min-w-0"
            />
            <Input
              type="password"
              placeholder="Password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              className="flex-1 min-w-0"
            />
            <select
              value={roleInput}
              onChange={e => setRoleInput(e.target.value as "staff" | "admin")}
              className="border rounded-md px-3 text-sm bg-background"
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            <Button onClick={() => addMutation.mutate()} disabled={!usernameInput || !passwordInput || addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Add</>}
            </Button>
          </div>
          <div className="border rounded-md p-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Lock className="h-3 w-3" /> Module permissions
              {roleInput === "admin" && (
                <span className="ml-1 text-muted-foreground/70">(admins always have full access)</span>
              )}
            </p>
            <ModuleChecklist
              idPrefix="new-user"
              selected={newUserPermissions}
              onChange={setNewUserPermissions}
              fullAccess={newUserFullAccess}
              onFullAccessChange={setNewUserFullAccess}
              disabled={roleInput === "admin"}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Staff Accounts</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">No staff accounts.</p>
          ) : (
            <div className="space-y-1">
              {data.map(staff => (
                <div key={staff.id} className="border-b last:border-0">
                  <div className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{staff.username}</p>
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(staff.createdAt).toLocaleDateString()}
                        {" · "}
                        <span className={staff.permissions?.length === 0 ? "text-destructive" : ""}>
                          {permissionsSummary(staff)}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <Badge variant={staff.role === "admin" ? "default" : "secondary"} className="text-xs">{staff.role}</Badge>
                      {staff.role === "staff" && staff.id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Edit permissions"
                          aria-label={`Edit permissions for ${staff.username}`}
                          data-testid={`button-edit-permissions-${staff.id}`}
                          onClick={() => openPermissionsPanel(staff)}
                        >
                          {expandedUserId === staff.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      )}
                      {staff.id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          title="Delete account"
                          aria-label={`Delete account ${staff.username}`}
                          data-testid={`button-delete-staff-${staff.id}`}
                          onClick={() => deleteMutation.mutate(staff.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {expandedUserId === staff.id && (
                    <div className="pb-3 px-1">
                      <div className="border rounded-md p-3 bg-muted/30 space-y-3">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <Lock className="h-3 w-3" /> Edit module access for <strong>{staff.username}</strong>
                        </p>
                        <ModuleChecklist
                          idPrefix={`edit-${staff.id}`}
                          selected={editPermissions}
                          onChange={setEditPermissions}
                          fullAccess={editFullAccess}
                          onFullAccessChange={setEditFullAccess}
                        />
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={() =>
                              updatePermissionsMutation.mutate({
                                id: staff.id,
                                permissions: editFullAccess ? null : editPermissions,
                              })
                            }
                            disabled={updatePermissionsMutation.isPending}
                          >
                            {updatePermissionsMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : null}
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setExpandedUserId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user?.role !== "admin") {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">You don't have admin access.</p>
        <Button className="mt-4" onClick={() => setLocation("/")}>Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold font-display">Admin Panel</h1>
      </div>

      <Tabs defaultValue="visitors">
        <TabsList>
          <TabsTrigger value="visitors">Visitors</TabsTrigger>
          <TabsTrigger value="allowlist">Allowlist</TabsTrigger>
          <TabsTrigger value="staff">Staff Accounts</TabsTrigger>
        </TabsList>
        <TabsContent value="visitors" className="mt-4">
          <VisitorsTab />
        </TabsContent>
        <TabsContent value="allowlist" className="mt-4">
          <AllowlistTab />
        </TabsContent>
        <TabsContent value="staff" className="mt-4">
          <StaffTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
