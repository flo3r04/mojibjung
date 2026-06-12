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
import { BookOpen, Users, GraduationCap, PenSquare, LogOut, User, LayoutDashboard, ShieldAlert, MessageSquare, Search, UserX, AlertTriangle, ShieldCheck, Calendar, Menu, Sun, Moon } from "lucide-react";
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

  const { data: userProfile } = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });

  // 메시지 알림은 정회원만 조회 (PENDING 사용자는 메시지 기능 자체가 차단됨)
  const { data: unreadCount } = trpc.message.totalUnreadCount.useQuery(undefined, {
    enabled: isAuthenticated && isVerified,
    refetchInterval: 15000,
  });

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
    <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border/40">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          
          {/* 1. 서비스 로고 섹션 */}
          <Link href="/" className="flex items-center gap-2.5 no-underline group">
            <Logo size={34} className="transition-transform group-hover:scale-105 duration-200" />
            <span className="hidden sm:block font-black tracking-tight text-[#0F2547] dark:text-slate-100 text-lg transition-colors duration-200">
              모집중
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1"></nav>

          {/* 2. 우측 액션 섹션 (로그인 여부에 따라 다르게 표시) */}
          <div className="flex items-center gap-2">

            {/* Search Button - 메인 페이지 돋보기 버튼 */}
            <Link href="/board">
              <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer">
                <Search className="w-4.5 h-4.5" />
              </Button>
            </Link>

            {/* Dark Mode Toggle Button */}
            {toggleTheme && (
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                onClick={toggleTheme}
                aria-label="테마 변경"
              >
                {theme === "dark" ? (
                  <Sun className="w-4.5 h-4.5 text-yellow-500 animate-in spin-in-45 duration-300" />
                ) : (
                  <Moon className="w-4.5 h-4.5" />
                )}
              </Button>
            )}

            {isAuthenticated ? (
              <>
                {/* [글 쓰기 버튼] */}
                <Link href="/post/new">
                  <Button size="sm" className="hidden sm:flex items-center gap-1.5 font-bold rounded-xl px-4 h-9 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all cursor-pointer shadow-xs active:scale-95 text-xs">
                    <PenSquare className="w-4 h-4" />
                    새 글 쓰기
                  </Button>
                </Link>

                {/* [메시지 버튼] */}
                <Link href="/messages">
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer relative">
                    <MessageSquare className="w-4.5 h-4.5" />
                    {unreadCount && unreadCount > 0 ? (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-primary text-white text-[9px] font-black rounded-full flex items-center justify-center border border-card px-0.5 shadow-sm">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    ) : null}
                  </Button>
                </Link>

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
                  
                  <DropdownMenuContent align="end" className="w-52 p-1.5 rounded-2xl border-border/50 shadow-xl bg-card/95 backdrop-blur-md">
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
                className="h-9 px-4 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground text-xs transition-all cursor-pointer shadow-xs active:scale-95"
              >
                로그인
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
