import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/dashboard";
import Websites from "@/pages/websites";
import WebsiteDetail from "@/pages/website-detail";
import Keywords from "@/pages/keywords";
import Social from "@/pages/social";
import Campaigns from "@/pages/campaigns";
import Backlinks from "@/pages/backlinks";
import Leads from "@/pages/leads";
import Analytics from "@/pages/analytics";
import AiTools from "@/pages/ai-tools";
import MediaAssets from "@/pages/media-assets";
import SettingsPage from "@/pages/settings";
import CalendarPage from "@/pages/calendar";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import ReportPage from "@/pages/report";
import LandingPage from "@/pages/landing";
import AdminPage from "@/pages/admin";
import ConversationsPage from "@/pages/conversations";
import BlogPage from "@/pages/blog";
import BlogPostPage from "@/pages/blog-post";
import KnowledgeBasePage from "@/pages/knowledge-base";
import KbArticlePage from "@/pages/kb-article";
import { AuthProvider, useAuth, usePermissions } from "@/contexts/AuthContext";
import { Loader2, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function AccessDenied() {
  const [, setLocation] = useLocation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <ShieldOff className="h-14 w-14 text-muted-foreground/50" />
      <div>
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You don't have permission to view this section.
          <br />
          Contact your administrator to request access.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => setLocation("/")}>
        Go to Dashboard
      </Button>
    </div>
  );
}

function PermissionGuard({ module, children }: { module: string; children: React.ReactNode }) {
  const { hasPermission } = usePermissions();
  if (!hasPermission(module)) {
    return <AccessDenied />;
  }
  return <>{children}</>;
}

function ProtectedRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/report" component={ReportPage} />
        <Route path="/" component={LandingPage} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        <Redirect to="/" />
      </Route>
      <Route path="/report" component={ReportPage} />
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/websites">
              <PermissionGuard module="websites"><Websites /></PermissionGuard>
            </Route>
            <Route path="/websites/:id">
              {(params) => (
                <PermissionGuard module="websites"><WebsiteDetail {...params} /></PermissionGuard>
              )}
            </Route>
            <Route path="/keywords">
              <PermissionGuard module="keywords"><Keywords /></PermissionGuard>
            </Route>
            <Route path="/social">
              <PermissionGuard module="social"><Social /></PermissionGuard>
            </Route>
            <Route path="/calendar">
              <PermissionGuard module="calendar"><CalendarPage /></PermissionGuard>
            </Route>
            <Route path="/campaigns">
              <PermissionGuard module="campaigns"><Campaigns /></PermissionGuard>
            </Route>
            <Route path="/backlinks">
              <PermissionGuard module="backlinks"><Backlinks /></PermissionGuard>
            </Route>
            <Route path="/leads">
              <PermissionGuard module="leads"><Leads /></PermissionGuard>
            </Route>
            <Route path="/conversations">
              <PermissionGuard module="conversations"><ConversationsPage /></PermissionGuard>
            </Route>
            <Route path="/analytics">
              <PermissionGuard module="analytics"><Analytics /></PermissionGuard>
            </Route>
            <Route path="/ai">
              <PermissionGuard module="ai_tools"><AiTools /></PermissionGuard>
            </Route>
            <Route path="/media">
              <PermissionGuard module="media"><MediaAssets /></PermissionGuard>
            </Route>
            <Route path="/blog/:slug">
              {(params) => <BlogPostPage key={params.slug} />}
            </Route>
            <Route path="/blog" component={BlogPage} />
            <Route path="/kb/:slug">
              {(params) => <KbArticlePage key={params.slug} />}
            </Route>
            <Route path="/kb" component={KnowledgeBasePage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/admin" component={AdminPage} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ProtectedRouter />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
