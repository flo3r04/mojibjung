import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import Home from "./pages/Home";
import Board from "./pages/Board";
import PostDetail from "./pages/PostDetail";
import PostForm from "./pages/PostForm";
import PostManage from "./pages/PostManage";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import MyPage from "./pages/MyPage";
import CalendarPage from "./pages/CalendarPage";
import TodoPage from "./pages/TodoPage";
import Admin from "./pages/Admin";
import Messages from "./pages/Messages";
import BlockManage from "./pages/BlockManage";
import GroupHub from "./pages/GroupHub";

/**
 * OnboardingGuard — 계정 정지 여부 및 가입 보류(pending) 상태를 체크하는 가드
 */
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  // 미인증 또는 학적 정보 누락 유저 강제 온보딩 리다이렉션
  useEffect(() => {
    const isNotFullyVerified = user && (user.status === "pending" || !user.realName || !user.verifiedEmail);
    if (isNotFullyVerified && location !== "/profile") {
      setLocation("/profile?setup=true");
    }
  }, [user, location, setLocation]);

  if (user && user.status === "disabled") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card rounded-3xl border border-border p-8 text-center shadow-lg">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
          </div>
          <h1 className="text-2xl font-black text-foreground mb-4">해당 계정은 정지되었습니다</h1>
          <p className="text-muted-foreground font-medium mb-8">
            커뮤니티 운영 원칙 위반 등의 사유로 계정 이용이 제한되었습니다. 자세한 사항은 관리자에게 문의해주세요.
          </p>
          <button 
            className="w-full bg-primary text-primary-foreground font-bold py-3 px-4 rounded-xl shadow-md hover:bg-primary/90 transition-all flex items-center justify-center"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            로그아웃 후 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 미인증 상태인데 다른 주소로 가려 할 때 렌더링 중지
  const isNotFullyVerified = user && (user.status === "pending" || !user.realName || !user.verifiedEmail);
  if (isNotFullyVerified && location !== "/profile") {
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* 일반 페이지 */}
      <Route path="/" component={Home} />
      <Route path="/board" component={Board} />
      <Route path="/post/new" component={PostForm} />
      <Route path="/post/:id/edit" component={PostForm} />
      <Route path="/post/:id/manage" component={PostManage} />
      <Route path="/post/:id" component={PostDetail} />
      <Route path="/profile" component={Profile} />
      <Route path="/user/:id" component={UserProfile} />
      <Route path="/mypage" component={MyPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/todo" component={TodoPage} />
      <Route path="/groups" component={GroupHub} />
      <Route path="/admin" component={Admin} />
      <Route path="/messages" component={Messages} />
      <Route path="/blocks" component={BlockManage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <OnboardingGuard>
            <Router />
          </OnboardingGuard>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
