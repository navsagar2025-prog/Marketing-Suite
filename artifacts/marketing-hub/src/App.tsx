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
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

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
            <Route path="/websites" component={Websites} />
            <Route path="/websites/:id" component={WebsiteDetail} />
            <Route path="/keywords" component={Keywords} />
            <Route path="/social" component={Social} />
            <Route path="/calendar" component={CalendarPage} />
            <Route path="/campaigns" component={Campaigns} />
            <Route path="/backlinks" component={Backlinks} />
            <Route path="/leads" component={Leads} />
            <Route path="/conversations" component={ConversationsPage} />
            <Route path="/analytics" component={Analytics} />
            <Route path="/ai" component={AiTools} />
            <Route path="/media" component={MediaAssets} />
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
