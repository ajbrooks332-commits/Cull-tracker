import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { setUnauthorizedHandler } from "@/hooks/use-api";
import { Layout } from "@/components/Layout";
import Login from "@/pages/Login";
import MapPage from "@/pages/MapPage";
import RecordsPage from "@/pages/RecordsPage";
import SessionsPage from "@/pages/SessionsPage";
import AssessmentsPage from "@/pages/AssessmentsPage";
import AdminPage from "@/pages/Admin";
import HelpPage from "@/pages/Help";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { stalker, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!stalker) return <Login />;

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  const { stalker, isLoading } = useAuth();
  
  if (isLoading) return null; // handled above but keeps router clean

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={MapPage} />} />
      <Route path="/records"  component={() => <ProtectedRoute component={RecordsPage} />} />
      <Route path="/sessions"     component={() => <ProtectedRoute component={SessionsPage} />} />
      <Route path="/assessments"  component={() => <ProtectedRoute component={AssessmentsPage} />} />
      <Route path="/admin"        component={() => <ProtectedRoute component={AdminPage} />} />
      <Route path="/help" component={() => <ProtectedRoute component={HelpPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function SessionWatcher() {
  const { logout } = useAuth();
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(() => {});
  }, [logout]);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionWatcher />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
