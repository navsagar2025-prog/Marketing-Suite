import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import { PromoBanner, PromoPopup } from "@/components/PromoSurfaces";
import { PageViewTracker } from "@/components/PageViewTracker";
import { PublicChatWidget } from "@/components/PublicChatWidget";
import { CustomCodeInjector } from "@/components/CustomCodeInjector";
import { AuthProvider, useAuth, usePermissions } from "@/contexts/AuthContext";
import { Loader2, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const Websites = lazy(() => import("@/pages/websites"));
const WebsiteDetail = lazy(() => import("@/pages/website-detail"));
const Keywords = lazy(() => import("@/pages/keywords"));
const Social = lazy(() => import("@/pages/social"));
const Campaigns = lazy(() => import("@/pages/campaigns"));
const Backlinks = lazy(() => import("@/pages/backlinks"));
const Leads = lazy(() => import("@/pages/leads"));
const Analytics = lazy(() => import("@/pages/analytics"));
const AiTools = lazy(() => import("@/pages/ai-tools"));
const MediaAssets = lazy(() => import("@/pages/media-assets"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const CalendarPage = lazy(() => import("@/pages/calendar"));
const NotFound = lazy(() => import("@/pages/not-found"));
const LoginPage = lazy(() => import("@/pages/login"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const ReportPage = lazy(() => import("@/pages/report"));
const LandingPage = lazy(() => import("@/pages/landing"));
const PricingPage = lazy(() => import("@/pages/pricing"));
const AdminPage = lazy(() => import("@/pages/admin"));
const AdminBlogPage = lazy(() => import("@/pages/admin-blog"));
const AdminCatalogPage = lazy(() => import("@/pages/admin-catalog"));
const AdminGalleryPage = lazy(() => import("@/pages/admin-gallery"));
const AdminPromotionsPage = lazy(() => import("@/pages/admin-promotions"));
const AdminSiteCodePage = lazy(() => import("@/pages/admin-site-code"));
const AdminChatbotPage = lazy(() => import("@/pages/admin-chatbot"));
const AdminSeoFillPage = lazy(() => import("@/pages/admin-seo-fill"));
const AdminSystemHealthPage = lazy(() => import("@/pages/admin-system-health"));
const AdminLiveTrafficPage = lazy(() => import("@/pages/admin-live-traffic"));
const ProductsPage = lazy(() => import("@/pages/products"));
const ProductDetailPage = lazy(() => import("@/pages/product-detail"));
const GalleryPage = lazy(() => import("@/pages/gallery"));
const ConversationsPage = lazy(() => import("@/pages/conversations"));
const BlogPage = lazy(() => import("@/pages/blog"));
const BlogPostPage = lazy(() => import("@/pages/blog-post"));
const KnowledgeBasePage = lazy(() => import("@/pages/knowledge-base"));
const KbArticlePage = lazy(() => import("@/pages/kb-article"));
const UtmBuilderPage = lazy(() => import("@/pages/utm-builder"));
const AbTestsPage = lazy(() => import("@/pages/ab-tests"));
const OutreachPage = lazy(() => import("@/pages/outreach"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const CompetitorsPage = lazy(() => import("@/pages/competitors"));
const LocalSeoPage = lazy(() => import("@/pages/local-seo"));
const ContentBriefPage = lazy(() => import("@/pages/content-brief"));
const ReportDetailPage = lazy(() => import("@/pages/report-detail"));
const SharedReportPage = lazy(() => import("@/pages/shared-report"));
const PublicHealthPage = lazy(() => import("@/pages/public-health"));
const WelcomePage = lazy(() => import("@/pages/welcome"));
const FilesPage = lazy(() => import("@/pages/files"));
const IntegrationsPage = lazy(() => import("@/pages/integrations"));
const ChangelogPage = lazy(() => import("@/pages/changelog"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

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

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <AccessDenied />;
  return <>{children}</>;
}

function ProtectedRouter() {
  const { user, isLoading } = useAuth();

  if (window.location.pathname.replace(/\/$/, "").endsWith("/welcome")) {
    return (
      <Suspense fallback={<PageLoader />}>
        <WelcomePage />
      </Suspense>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <CustomCodeInjector />
        <PublicChatWidget />
        <PromoBanner audience="all" />
        <PromoPopup audience="all" />
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/forgot-password" component={ForgotPasswordPage} />
          <Route path="/reset-password" component={ResetPasswordPage} />
          <Route path="/welcome" component={WelcomePage} />
          <Route path="/pricing" component={PricingPage} />
          <Route path="/integrations" component={IntegrationsPage} />
          <Route path="/changelog" component={ChangelogPage} />
          <Route path="/report/:token">
            {(params) => <SharedReportPage token={params.token ?? ""} />}
          </Route>
          <Route path="/report" component={ReportPage} />
          <Route path="/shared-report/:token">
            {(params) => <SharedReportPage token={params.token ?? ""} />}
          </Route>
          <Route path="/health/:token">
            {(params) => <PublicHealthPage token={params.token ?? ""} />}
          </Route>
          <Route path="/products/:slug" component={ProductDetailPage} />
          <Route path="/products" component={ProductsPage} />
          <Route path="/gallery" component={GalleryPage} />
          <Route path="/" component={LandingPage} />
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/login">
          <Redirect to="/" />
        </Route>
        <Route path="/welcome" component={WelcomePage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/integrations" component={IntegrationsPage} />
        <Route path="/changelog" component={ChangelogPage} />
        <Route path="/report/:token">
          {(params) => <SharedReportPage token={params.token ?? ""} />}
        </Route>
        <Route path="/report" component={ReportPage} />
        <Route path="/shared-report/:token">
          {(params) => <SharedReportPage token={params.token ?? ""} />}
        </Route>
        <Route path="/health/:token">
          {(params) => <PublicHealthPage token={params.token ?? ""} />}
        </Route>
        <Route>
          <Layout>
            <Suspense fallback={<PageLoader />}>
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
                <Route path="/competitors">
                  <PermissionGuard module="keywords"><CompetitorsPage /></PermissionGuard>
                </Route>
                <Route path="/local-seo">
                  <PermissionGuard module="keywords"><LocalSeoPage /></PermissionGuard>
                </Route>
                <Route path="/content-brief">
                  <PermissionGuard module="keywords"><ContentBriefPage /></PermissionGuard>
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
                <Route path="/utm-builder" component={UtmBuilderPage} />
                <Route path="/ab-tests">
                  <PermissionGuard module="analytics"><AbTestsPage /></PermissionGuard>
                </Route>
                <Route path="/outreach">
                  <PermissionGuard module="backlinks"><OutreachPage /></PermissionGuard>
                </Route>
                <Route path="/reports/:id">
                  {(params) => (
                    <PermissionGuard module="analytics"><ReportDetailPage id={params.id ?? ""} /></PermissionGuard>
                  )}
                </Route>
                <Route path="/reports">
                  <PermissionGuard module="analytics"><ReportsPage /></PermissionGuard>
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
                <Route path="/files" component={FilesPage} />
                <Route path="/admin/blog" component={AdminBlogPage} />
                <Route path="/admin/catalog"><AdminGuard><AdminCatalogPage /></AdminGuard></Route>
                <Route path="/admin/gallery"><AdminGuard><AdminGalleryPage /></AdminGuard></Route>
                <Route path="/admin/promotions"><AdminGuard><AdminPromotionsPage /></AdminGuard></Route>
                <Route path="/admin/site-code"><PermissionGuard module="site_code"><AdminSiteCodePage /></PermissionGuard></Route>
                <Route path="/admin/chatbot"><AdminGuard><AdminChatbotPage /></AdminGuard></Route>
                <Route path="/admin/seo-fill"><AdminGuard><AdminSeoFillPage /></AdminGuard></Route>
                <Route path="/admin/system-health"><AdminGuard><AdminSystemHealthPage /></AdminGuard></Route>
                <Route path="/admin/live-traffic"><AdminGuard><AdminLiveTrafficPage /></AdminGuard></Route>
                <Route path="/products/:slug" component={ProductDetailPage} />
                <Route path="/products" component={ProductsPage} />
                <Route path="/gallery" component={GalleryPage} />
                <Route path="/admin" component={AdminPage} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </Layout>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <PageViewTracker />
            <ProtectedRouter />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
