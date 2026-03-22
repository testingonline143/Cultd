import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { useLogin } from "@/hooks/use-login";
import { useAuthModal, AuthModalProvider } from "@/hooks/use-auth-modal";
import { AuthModal } from "@/components/auth-modal";
import { useEffect, useState, lazy, Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { Loader as Loader2 } from "lucide-react";

const Home            = lazy(() => import("@/pages/home"));
const Login           = lazy(() => import("@/pages/login"));
const ResetPassword   = lazy(() => import("@/pages/reset-password"));
const Admin           = lazy(() => import("@/pages/admin"));
const OrganizerDashboard = lazy(() => import("@/pages/organizer"));
const Profile         = lazy(() => import("@/pages/profile"));
const Onboarding      = lazy(() => import("@/pages/onboarding"));
const MatchedClubs    = lazy(() => import("@/pages/matched-clubs"));
const Explore         = lazy(() => import("@/pages/explore"));
const Events          = lazy(() => import("@/pages/events"));
const Create          = lazy(() => import("@/pages/create"));
const ClubDetail      = lazy(() => import("@/pages/club-detail"));
const EventDetail     = lazy(() => import("@/pages/event-detail"));
const HomeFeed        = lazy(() => import("@/pages/home-feed"));
const ScanEvent       = lazy(() => import("@/pages/scan-event"));
const Notifications   = lazy(() => import("@/pages/notifications"));
const MemberProfile   = lazy(() => import("@/pages/member-profile"));
const PublicClub      = lazy(() => import("@/pages/public-club"));
const PageBuilder     = lazy(() => import("@/pages/page-builder"));
const MyPayments      = lazy(() => import("@/pages/my-payments"));
const OrganizerEarnings = lazy(() => import("@/pages/organizer/EarningsPage"));
const NotFound        = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--cream)" }}
    >
      {show && <Loader2 className="h-8 w-8 animate-spin opacity-40" />}
    </div>
  );
}

const QUIZ_EXEMPT_PATHS = ["/", "/login", "/onboarding", "/matched-clubs", "/admin", "/c"];

function QuizGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (user && !user.quizCompleted && !QUIZ_EXEMPT_PATHS.some(p => location === p || location.startsWith(p + "/"))) {
      navigate("/onboarding");
    }
  }, [user, location, navigate]);

  return <>{children}</>;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const { login } = useLogin();

  useEffect(() => {
    // Only redirect if authentication check has finished
    if (!isLoading && !isAuthenticated) {
      if (typeof navigate === 'function') {
        navigate(`/login?returnTo=${encodeURIComponent(location)}`);
      } else {
         window.location.href = `/login?returnTo=${encodeURIComponent(location)}`;
      }
    }
  }, [isLoading, isAuthenticated, location, navigate]);

  if (isLoading || !isAuthenticated) {
    return <PageLoader />;
  }

  return <Component />;
}


function GlobalAuthModal() {
  const { showAuthModal, closeAuthModal, signIn, signUp } = useAuthModal();
  if (!showAuthModal) return null;
  return <AuthModal onClose={closeAuthModal} onSignIn={signIn} onSignUp={signUp} />;
}

function RootRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    const timeoutId = setTimeout(() => {
      if (!user.quizCompleted) {
        navigate("/onboarding");
      } else {
        const redirectTo = sessionStorage.getItem("redirectAfterAuth");
        sessionStorage.removeItem("redirectAfterAuth");
        navigate(redirectTo || "/home");
      }
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || isAuthenticated) return <PageLoader />;
  return <Home />;
}

function Router() {
  return (
    <AuthModalProvider>
      <GlobalAuthModal />
        <QuizGate>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/" component={RootRoute} />
            <Route path="/login" component={Login} />
            <Route path="/reset-password" component={ResetPassword} />
            <Route path="/onboarding" component={() => <ProtectedRoute component={Onboarding} />} />
            <Route path="/admin" component={Admin} />
            <Route path="/home" component={() => <ProtectedRoute component={HomeFeed} />} />
            <Route path="/organizer" component={() => <ProtectedRoute component={OrganizerDashboard} />} />
            <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
            <Route path="/matched-clubs" component={() => <ProtectedRoute component={MatchedClubs} />} />
            <Route path="/explore" component={() => <ProtectedRoute component={Explore} />} />
            <Route path="/events" component={() => <ProtectedRoute component={Events} />} />
            <Route path="/create" component={() => <ProtectedRoute component={Create} />} />
            <Route path="/notifications" component={() => <ProtectedRoute component={Notifications} />} />
            <Route path="/scan/:eventId" component={() => <ProtectedRoute component={ScanEvent} />} />
            <Route path="/event/:id" component={() => <ProtectedRoute component={EventDetail} />} />
            <Route path="/club/:id" component={() => <ProtectedRoute component={ClubDetail} />} />
            <Route path="/member/:id" component={() => <ProtectedRoute component={MemberProfile} />} />
            <Route path="/c/:slug" component={PublicClub} />
            <Route path="/organizer/earnings" component={() => <ProtectedRoute component={OrganizerEarnings} />} />
            <Route path="/organizer/page-builder" component={() => <ProtectedRoute component={PageBuilder} />} />
            <Route path="/my-payments" component={() => <ProtectedRoute component={MyPayments} />} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
          <BottomNav />
        </QuizGate>
    </AuthModalProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

