import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link, useLocation } from "wouter";
import { BookOpen, Users, GraduationCap, PenSquare, LogOut, User, LayoutDashboard, ShieldAlert, MessageSquare, Search, UserX, AlertTriangle, ShieldCheck, Calendar, Menu, Sun, Moon, ListTodo, Bell, Globe, MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useTheme } from "../contexts/ThemeContext";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// * [네비게이션 바 컴포넌트]
// * 화면 상단에 항상 고정되어 서비스 로고, 새 글 쓰기, 사용자 메뉴 등을 제공합니다.
export default function Navbar() {
  // 인증 정보 및 로그아웃 함수 가져오기
  const { user, isAuthenticated, isVerified, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();

  const [withdrawConfirmText, setWithdrawConfirmText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/board?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const isActive = (path: string) => {
    if (path === "/board") {
      return location === "/board" && (typeof window !== "undefined" ? !window.location.search : true);
    }
    if (path.startsWith("/board?category=")) {
      const cat = path.split("=")[1];
      const currentParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      return location === "/board" && currentParams.get("category") === decodeURIComponent(cat);
    }
    return location === path;
  };

  const { data: userProfile } = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });

  // 메시지 알림은 정회원만 조회 (PENDING 사용자는 메시지 기능 자체가 차단됨)
  const { data: unreadCount } = trpc.message.totalUnreadCount.useQuery(undefined, {
    enabled: isAuthenticated && isVerified,
    refetchInterval: 15000,
  });

  const { data: notifications = [], refetch: refetchNotifications } = trpc.notification.list.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });

  const markAsReadMutation = trpc.notification.markAsRead.useMutation({
    onSuccess: () => refetchNotifications(),
  });

  const markAllAsReadMutation = trpc.notification.markAllAsRead.useMutation({
    onSuccess: () => refetchNotifications(),
  });

  const unreadNotifCount = notifications.filter(n => n.isRead === 0).length;

  const withdrawMutation = trpc.auth.withdraw.useMutation({
    onSuccess: () => {
      toast.success("회원 탈퇴가 완료되었습니다. 그동안 이용해주셔서 감사합니다.");
      window.location.href = "/";
    },
    onError: (err) => {
      toast.error(err.message || "탈퇴 처리 중 오류가 발생했습니다.");
    },
  });

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border/40 select-none">
      <div className="container">
        
        {/* Top Row: Brand Logo & Right System Actions */}
        <div className="flex items-center justify-between h-14">
          
          {/* 1. 서비스 로고 섹션 */}
          <Link href="/" className="flex items-center gap-2.5 no-underline group shrink-0">
            <Logo size={32} className="transition-transform group-hover:scale-105 duration-200" />
            <span className="hidden sm:block font-black tracking-tight text-[#0F2547] dark:text-slate-100 text-base transition-colors duration-200">
              모집중
            </span>
          </Link>

          {/* 2. 우측 시스템 설정 & 사용자 액션 섹션 */}
          <div className="flex items-center gap-2.5">
            
            {/* Language Selection Badge */}
            <div className="hidden md:flex items-center gap-1.5 text-[11.5px] font-bold text-muted-foreground bg-muted/40 border border-border/40 px-2.5 py-1.5 rounded-lg select-none">
              <Globe className="w-3.5 h-3.5" />
              <span>Korean</span>
            </div>

            {/* Location/Server Selection Badge */}
            <div className="hidden md:flex items-center gap-1.5 text-[11.5px] font-bold text-muted-foreground bg-muted/40 border border-border/40 px-2.5 py-1.5 rounded-lg select-none">
              <MapPin className="w-3.5 h-3.5" />
              <span>한국외대</span>
            </div>

            {/* Theme Toggle Button with text */}
            {toggleTheme && (
              <Button
                variant="outline"
                size="sm"
                className="h-8.5 px-3 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground text-xs font-semibold gap-1.5 flex items-center cursor-pointer active:scale-95"
                onClick={toggleTheme}
                aria-label="테마 변경"
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-yellow-500 animate-in spin-in-45 duration-300" />
                    <span>라이트</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5" />
                    <span>다크</span>
                  </>
                )}
              </Button>
            )}

            {/* User Profile & Actions Group */}
            <div className="flex items-center gap-2 border-l border-border/60 pl-2.5">
              
              {/* Search button for Mobile (redirects to /board) */}
              <Link href="/board" className="sm:hidden">
                <Button size="icon" variant="ghost" className="h-8.5 w-8.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer">
                  <Search className="w-4 h-4" />
                </Button>
              </Link>

              {isAuthenticated ? (
                <>
                  {/* [메시지 버튼] */}
                  <Link href="/messages">
                    <Button variant="ghost" size="icon" className="h-8.5 w-8.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer relative">
                      <MessageSquare className="w-4 h-4" />
                      {unreadCount && unreadCount > 0 ? (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] bg-primary text-white text-[8px] font-black rounded-full flex items-center justify-center border border-card px-0.5 shadow-sm">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      ) : null}
                    </Button>
                  </Link>

                  {/* [실시간 알림 벨 버튼] */}
                  <DropdownMenu onOpenChange={(open) => {
                    if (open && unreadNotifCount > 0) {
                      markAllAsReadMutation.mutate();
                    }
                  }}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8.5 w-8.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer relative">
                        <Bell className="w-4 h-4" />
                        {unreadNotifCount > 0 ? (
                          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] bg-destructive text-white text-[8px] font-black rounded-full flex items-center justify-center border border-card px-0.5 shadow-sm animate-pulse">
                            {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                          </span>
                        ) : null}
                      </Button>
                    </DropdownMenuTrigger>
                    
                    <DropdownMenuContent align="end" className="w-80 p-2 rounded-2xl border border-border/50 shadow-xl bg-card/95 backdrop-blur-md max-h-[350px] overflow-y-auto">
                      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/40 select-none mb-1">
                        <span className="font-black text-xs text-foreground flex items-center gap-1">
                          🔔 알림 센터
                        </span>
                        {unreadNotifCount > 0 && (
                          <button
                            onClick={() => markAllAsReadMutation.mutate()}
                            className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                          >
                            모두 읽음
                          </button>
                        )}
                      </div>
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-xs font-bold text-muted-foreground/60">
                          수신된 알림이 없습니다.
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {notifications.map((notif) => (
                            <DropdownMenuItem
                              key={notif.id}
                              asChild
                              className={`p-2 rounded-xl text-xs flex flex-col items-start gap-1 cursor-pointer transition-all ${
                                notif.isRead === 0 ? "bg-primary/5 hover:bg-primary/10 font-bold" : "text-muted-foreground"
                              }`}
                            >
                              <Link 
                                href={notif.link || "#"}
                                onClick={() => {
                                  if (notif.isRead === 0) {
                                    markAsReadMutation.mutate({ id: notif.id });
                                  }
                                }}
                                className="w-full flex flex-col items-start"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className={`text-[11px] font-black ${notif.isRead === 0 ? "text-primary" : "text-muted-foreground"}`}>
                                    {notif.title}
                                  </span>
                                  <span className="text-[9px] font-medium text-muted-foreground/80">
                                    {new Date(notif.createdAt).toLocaleDateString("ko-KR")}
                                  </span>
                                </div>
                                <p className="text-[10px] leading-relaxed text-left text-muted-foreground/80 truncate w-full mt-0.5">
                                  {notif.content}
                                </p>
                              </Link>
                            </DropdownMenuItem>
                          ))}
                        </div>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* [사용자 프로필 드롭다운 메뉴] */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="relative flex items-center justify-center rounded-full hover:scale-105 transition-all p-0.5 cursor-pointer focus:outline-hidden">
                        <Avatar className="w-8 h-8 border border-border/60">
                          <AvatarFallback className="bg-primary/15 text-primary text-xs font-black">
                            {user?.realName?.charAt(0) ?? user?.name?.charAt(0) ?? "U"}
                          </AvatarFallback>
                        </Avatar>
                        {isVerified && (
                          <div className="absolute -bottom-0.5 -right-0.5 bg-background dark:bg-slate-900 rounded-full p-0.5 border border-border shadow-xs shrink-0">
                            <ShieldCheck className="w-3 h-3 text-emerald-500 fill-emerald-500/10" />
                          </div>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    
                    <DropdownMenuContent align="end" className="w-52 p-1.5 rounded-2xl border border-border/50 shadow-xl bg-card/95 backdrop-blur-md">
                      {/* 사용자 정보 헤더 */}
                      <div className="px-2 py-1.5 mb-1.5 border-b border-border/40 select-none">
                        <div className="flex items-center gap-1">
                          <span className="font-black text-xs text-foreground truncate max-w-[130px]">
                            {user?.realName ?? user?.name ?? "사용자"}
                          </span>
                          {isVerified && (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/10 shrink-0" />
                          )}
                        </div>
                        <span className="text-[9.5px] text-muted-foreground font-semibold truncate block mt-0.5">
                          {user?.verifiedEmail ?? "이메일 미연동"}
                        </span>
                      </div>

                      {/* 마이페이지 링크 */}
                      <DropdownMenuItem asChild>
                        <Link href="/mypage" className="flex items-center gap-2 cursor-pointer rounded-xl py-2 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
                          <LayoutDashboard className="w-4 h-4" />
                          마이페이지
                        </Link>
                      </DropdownMenuItem>

                      {/* 마이캘린더 링크 */}
                      <DropdownMenuItem asChild>
                        <Link href="/calendar" className="flex items-center gap-2 cursor-pointer rounded-xl py-2 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
                          <Calendar className="w-4 h-4" />
                          마이캘린더
                        </Link>
                      </DropdownMenuItem>

                      {/* 마이투두 링크 */}
                      <DropdownMenuItem asChild>
                        <Link href="/todo" className="flex items-center gap-2 cursor-pointer rounded-xl py-2 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
                          <ListTodo className="w-4 h-4" />
                          마이투두
                        </Link>
                      </DropdownMenuItem>

                      {/* 그룹 소통/일정 링크 */}
                      <DropdownMenuItem asChild>
                        <Link href="/groups" className="flex items-center gap-2 cursor-pointer rounded-xl py-2 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
                          <Users className="w-4 h-4" />
                          그룹 소통/일정
                        </Link>
                      </DropdownMenuItem>

                      {/* 메시지 링크 */}
                      <DropdownMenuItem asChild>
                        <Link href="/messages" className="flex items-center gap-2 cursor-pointer rounded-xl py-2 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
                          <MessageSquare className="w-4 h-4" />
                          메시지함
                        </Link>
                      </DropdownMenuItem>
                      
                      {/* 프로필 설정 링크 */}
                      <DropdownMenuItem asChild>
                        <Link href="/profile" className="flex items-center gap-2 cursor-pointer rounded-xl py-2 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
                          <User className="w-4 h-4" />
                          프로필 설정
                        </Link>
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      
                      {/* 관리자 대시보드 (관리자 계정만 표시) */}
                      {user?.role === "admin" && (
                        <DropdownMenuItem asChild>
                          <Link href="/admin" className="flex items-center gap-2 cursor-pointer text-primary rounded-xl py-2 px-2.5 text-xs font-semibold">
                            <ShieldAlert className="w-4 h-4" />
                            관리자 대시보드
                          </Link>
                        </DropdownMenuItem>
                      )}
                      
                      {/* 로그아웃 버튼 */}
                      <DropdownMenuItem
                        onClick={() => logout()}
                        className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer rounded-xl py-2 px-2.5 text-xs font-semibold"
                      >
                        <LogOut className="w-4 h-4" />
                        로그아웃
                      </DropdownMenuItem>

                      {/* 회원 탈퇴 버튼 (AlertDialog와 연동) */}
                      <AlertDialog onOpenChange={(open) => !open && setWithdrawConfirmText("")}>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            className="text-muted-foreground hover:text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer rounded-xl py-2 px-2.5 text-xs font-semibold"
                          >
                            <UserX className="w-4 h-4" />
                            회원 탈퇴
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl border-destructive/20 shadow-2xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-2xl font-black text-foreground flex items-center gap-2">
                              <AlertTriangle className="w-6 h-6 text-destructive" />
                              정말 탈퇴하시겠어요?
                            </AlertDialogTitle>
                            <div className="text-muted-foreground pt-2 space-y-4">
                              <p>회원 탈퇴 시 작성하신 모집 글, 신청 내역, 프로필 정보가 모두 영구적으로 삭제됩니다. 이 작업은 취소할 수 없습니다.</p>
                              
                              <div className="p-4 bg-destructive/5 rounded-2xl border border-destructive/10 space-y-3">
                                <p className="text-sm font-bold text-destructive">
                                  탈퇴를 확인하려면 아래에 <span className="underline underline-offset-2">"탈퇴하기"</span>를 직접 입력해주세요.
                                </p>
                                <Input
                                  value={withdrawConfirmText}
                                  onChange={(e) => setWithdrawConfirmText(e.target.value)}
                                  placeholder="탈퇴하기"
                                  className="bg-card border-destructive/20 focus-visible:ring-destructive h-12 rounded-xl text-center font-black text-lg"
                                />
                              </div>
                            </div>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="gap-2 mt-4">
                            <AlertDialogCancel className="rounded-xl font-bold h-11">취소</AlertDialogCancel>
                            <AlertDialogAction
                              disabled={withdrawConfirmText !== "탈퇴하기" || withdrawMutation.isPending}
                              onClick={() => withdrawMutation.mutate()}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-30 disabled:grayscale rounded-xl font-black h-11 px-6 border-0"
                            >
                              {withdrawMutation.isPending ? "처리 중..." : "탈퇴하기"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                // [로그인 버튼] 로그인되지 않은 경우 표시
                <Button
                  size="sm"
                  onClick={() => (window.location.href = getLoginUrl())}
                  className="h-8.5 px-4 rounded-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground text-xs transition-all cursor-pointer shadow-xs active:scale-95 border border-primary/20"
                >
                  로그인
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row: Sub Navigation Items & Horizontal Search Form */}
        <div className="flex items-center justify-between h-11 border-t border-border/40 select-none">
          {/* Horizontal scrollable links */}
          <nav className="flex items-center gap-5 md:gap-7 overflow-x-auto scrollbar-hide py-1 flex-nowrap shrink-0 max-w-[70%] sm:max-w-[78%]">
            <Link 
              href="/board" 
              className={`text-[12.5px] sm:text-xs no-underline whitespace-nowrap transition-colors py-1 ${isActive("/board") ? "text-primary font-black border-b-2 border-primary" : "text-muted-foreground/80 hover:text-foreground font-bold"}`}
            >
              전체 모집
            </Link>
            <Link 
              href="/board?category=동아리" 
              className={`text-[12.5px] sm:text-xs no-underline whitespace-nowrap transition-colors py-1 ${isActive("/board?category=동아리") ? "text-primary font-black border-b-2 border-primary" : "text-muted-foreground/80 hover:text-foreground font-bold"}`}
            >
              동아리 모집
            </Link>
            <Link 
              href="/board?category=학회" 
              className={`text-[12.5px] sm:text-xs no-underline whitespace-nowrap transition-colors py-1 ${isActive("/board?category=학회") ? "text-primary font-black border-b-2 border-primary" : "text-muted-foreground/80 hover:text-foreground font-bold"}`}
            >
              학회 모집
            </Link>
            <Link 
              href="/board?category=스터디" 
              className={`text-[12.5px] sm:text-xs no-underline whitespace-nowrap transition-colors py-1 ${isActive("/board?category=스터디") ? "text-primary font-black border-b-2 border-primary" : "text-muted-foreground/80 hover:text-foreground font-bold"}`}
            >
              스터디 모집
            </Link>
            <Link 
              href="/calendar" 
              className={`text-[12.5px] sm:text-xs no-underline whitespace-nowrap transition-colors py-1 ${isActive("/calendar") ? "text-primary font-black border-b-2 border-primary" : "text-muted-foreground/80 hover:text-foreground font-bold"}`}
            >
              캘린더
            </Link>
            <Link 
              href="/todo" 
              className={`text-[12.5px] sm:text-xs no-underline whitespace-nowrap transition-colors py-1 ${isActive("/todo") ? "text-primary font-black border-b-2 border-primary" : "text-muted-foreground/80 hover:text-foreground font-bold"}`}
            >
              마이투두
            </Link>
            <Link 
              href="/groups" 
              className={`text-[12.5px] sm:text-xs no-underline whitespace-nowrap transition-colors py-1 ${isActive("/groups") ? "text-primary font-black border-b-2 border-primary" : "text-muted-foreground/80 hover:text-foreground font-bold"}`}
            >
              그룹 소통
            </Link>
          </nav>

          {/* Right Side: Search bar & User status badge / Write button */}
          <div className="flex items-center gap-3">
            {/* Search Input Box */}
            <form onSubmit={handleSearchSubmit} className="hidden sm:flex items-center relative w-44 md:w-52">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="모집글 검색..."
                className="h-7.5 pl-8 pr-3 text-[11px] font-bold rounded-lg bg-muted/40 border-border/60 focus-visible:ring-primary/30 focus:bg-card w-full"
              />
              <Search className="w-3.5 h-3.5 text-muted-foreground/75 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </form>

            {/* Quick Profile Status / Write Button */}
            {isAuthenticated ? (
              <div className="hidden sm:flex items-center gap-2">
                <Link href="/post/new">
                  <Button size="sm" className="h-7.5 px-3 rounded-lg font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all cursor-pointer shadow-xs active:scale-95 text-[10.5px] whitespace-nowrap shrink-0">
                    <PenSquare className="w-3.5 h-3.5 mr-1" />
                    새 글 쓰기
                  </Button>
                </Link>
                {user && (
                  <div className="hidden md:flex items-center gap-1.5 bg-muted border border-border text-muted-foreground font-black text-[10px] px-2.5 py-1 rounded-lg shrink-0 select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{user.realName || user.name}</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

      </div>
    </header>
  );
}
