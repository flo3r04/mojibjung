import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

// * useAuth 옵션 타입 정의
// * - redirectOnUnauthenticated: 로그인되지 않았을 때 특정 페이지로 이동시킬지 여부
// * - redirectPath: 리다이렉트할 경로 (기본값: 로그인 URL)
type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

// * [인증 전용 커스텀 훅]
// * 서비스 어디서든 현재 사용자의 로그인 상태를 확인하고 로그아웃 기능을 사용할 수 있게 합니다.
export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils(); // tRPC 캐시 제어를 위한 도구

  // [데이터 조회] 현재 로그인된 유저 정보 가져오기 (tRPC auth.me)
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false, // 실패 시 재시도 안 함
    refetchOnWindowFocus: false, // 탭 포커스 시 자동 갱신 안 함
  });

  // [로그아웃 API 요청]
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      // 로그아웃 성공 시 클라이언트 측 유저 데이터 즉시 초기화
      utils.auth.me.setData(undefined, null);
    },
  });

  // * 로그아웃 실행 함수
  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      // 이미 권한이 없는 상태라면 그냥 무시
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      // 성공/실패 여부와 상관없이 클라이언트 캐시를 지우고 새로고침
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  // * 현재 인증 상태 요약 (Memoization으로 최적화)
  const state = useMemo(() => {
    // 런타임 디버깅을 위해 로컬 스토리지에 정보 저장 (선택 사항)
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    const user = meQuery.data ?? null;
    const status = user?.status ?? null;
    return {
      user, // 유저 객체 (전체 User row)
      loading: meQuery.isLoading || logoutMutation.isPending, // 로딩 상태 여부
      error: meQuery.error ?? logoutMutation.error ?? null, // 에러 정보
      isAuthenticated: Boolean(user), // 로그인 여부 (true/false)
      // 가입 상태 헬퍼 — onboarding 가드 / 권한 분기에 사용
      isPending: status === "pending",
      isVerified: status === "verified",
      isDisabled: status === "disabled",
      needsOnboarding: status === "pending",
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  // * [자동 리다이렉트 로직]
  // * 로그인하지 않은 사용자가 접근하면 로그인 페이지로 튕겨냅니다.
  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return; // 로그인되어 있으면 통과
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return; // 이미 리다이렉트 대상 페이지면 중단

    window.location.href = redirectPath;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(), // 정보 강제 갱신 함수
    logout, // 로그아웃 함수
  };
}
