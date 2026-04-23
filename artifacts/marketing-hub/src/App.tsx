import { Switch, Route, Router as WouterRouter } from "wouter";
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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/websites" component={Websites} />
        <Route path="/websites/:id" component={WebsiteDetail} />
        <Route path="/keywords" component={Keywords} />
        <Route path="/social" component={Social} />
        <Route path="/campaigns" component={Campaigns} />
        <Route path="/backlinks" component={Backlinks} />
        <Route path="/leads" component={Leads} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/ai" component={AiTools} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
