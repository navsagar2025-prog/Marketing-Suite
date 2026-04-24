import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Plus, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  createdAt: string;
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

function AuditRequestsTab() {
  const { data, isLoading } = useAdminFetch<AuditRequest[]>(["admin-audit-requests"], "/api/admin/audit-requests");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Public Audit Requests</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">No audit requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-2 font-medium">IP</th>
                  <th className="text-left py-2 font-medium">URL</th>
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-right py-2 font-medium">Count</th>
                  <th className="text-left py-2 font-medium">Last Request</th>
                </tr>
              </thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 font-mono">{r.ip}</td>
                    <td className="py-2 max-w-[200px] truncate text-muted-foreground">{r.url ?? "—"}</td>
                    <td className="py-2">{r.date}</td>
                    <td className="py-2 text-right">
                      <Badge variant={r.count >= 2 ? "destructive" : "secondary"} className="text-xs">{r.count}</Badge>
                    </td>
                    <td className="py-2 text-muted-foreground">{new Date(r.lastRequestAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
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

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${base}/api/admin/staff`, {
        method: "POST",
        headers,
        body: JSON.stringify({ username: usernameInput, password: passwordInput, role: roleInput }),
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
      toast({ title: "Staff account created" });
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Add Staff Account</CardTitle></CardHeader>
        <CardContent>
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
            <div className="space-y-2">
              {data.map(staff => (
                <div key={staff.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{staff.username}</p>
                    <p className="text-xs text-muted-foreground">Created {new Date(staff.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={staff.role === "admin" ? "default" : "secondary"} className="text-xs">{staff.role}</Badge>
                    {staff.id !== currentUser?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(staff.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
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

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Audit Requests</TabsTrigger>
          <TabsTrigger value="allowlist">Allowlist</TabsTrigger>
          <TabsTrigger value="staff">Staff Accounts</TabsTrigger>
        </TabsList>
        <TabsContent value="requests" className="mt-4">
          <AuditRequestsTab />
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
