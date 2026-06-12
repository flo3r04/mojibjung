import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { SignJWT } from "jose";
import { getJwtSecret } from "./env";
import { AuditAction, logAuditFromReq } from "./audit";

// * 쿼리 파라미터에서 특정 키의 값을 안전하게 가져오는 함수
function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

// * [카카오 로그인 라우터 등록]
// * 카카오 인증 서버로부터 리다이렉트되는 콜백 주소를 처리합니다.
export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");

    if (!code) {
      res.status(400).json({ error: "인증 코드가 없습니다." });
      return;
    }

    try {
      const kakaoClientId = process.env.VITE_KAKAO_CLIENT_ID;
      if (!kakaoClientId) {
        throw new Error("VITE_KAKAO_CLIENT_ID가 설정되지 않았습니다.");
      }
      
      // 현재 환경(개발/운영)에 맞는 리다이렉트 URI 생성
      const protocol = process.env.NODE_ENV === "production" ? "https" : req.protocol;
      const redirectUri = `${protocol}://${req.get("host")}/api/oauth/callback`;

      // 1. [토큰 요청] 인증 코드를 카카오 토큰으로 교환
      const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: kakaoClientId,
          redirect_uri: redirectUri,
          code,
        }),
      });

      if (!tokenRes.ok) {
        const errJson = await tokenRes.text();
        console.error("카카오 토큰 에러:", errJson);
        logAuditFromReq(req, {
          action: AuditAction.LOGIN_KAKAO_FAILED,
          metadata: { reason: "kakao_token_exchange_failed", error: errJson },
        });
        const frontendUrl =
          process.env.NODE_ENV === "development" ? "http://localhost:5173" : "";
        res.redirect(302, `${frontendUrl}/?error=oauth_failed`);
        return;
      }
      
      const tokenData = await tokenRes.json();

      // 2. [사용자 정보 요청] 받은 액세스 토큰으로 카카오 사용자 정보 조회
      const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!userRes.ok) {
        throw new Error("카카오 사용자 정보를 가져오는데 실패했습니다.");
      }

      const userData = await userRes.json();
      const openId = String(userData.id); // 카카오 고유 ID
      const nickname = userData.kakao_account?.profile?.nickname || "카카오 유저";
      const email = userData.kakao_account?.email || null;

      // 3. [DB 저장] 사용자 정보를 DB에 생성하거나 업데이트
      //    신규 사용자라면 schema 의 default 로 status='pending' 이 자동 적용됨.
      //    기존 사용자의 status 는 upsertUser 가 건드리지 않으므로 그대로 유지됨.
      await db.upsertUser({
        openId,
        name: nickname,
        email,
        loginMethod: "kakao",
        lastSignedIn: new Date(),
      });

      // 4. [JWT 세션 생성] 자체 서비스 세션을 위한 토큰 발행 (유효기간 1년)
      const sessionToken = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(openId)
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + ONE_YEAR_MS / 1000)
        .sign(getJwtSecret());

      // 5. [쿠키 설정] 생성된 토큰을 브라우저 쿠키에 저장
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // 6. [가입 상태 + 프로필 설정 여부 기반 리다이렉트]
      //    PENDING                                   → /onboarding         (기본 정보 입력 미완료)
      //    VERIFIED + 프로필 미설정                  → /profile?setup=true (선택 정보 입력 유도)
      //    VERIFIED + 프로필 설정됨                  → /                   (메인)
      //    DISABLED                                  → /?error=account_disabled
      const user = await db.getUserByOpenId(openId);
      const frontendUrl = process.env.NODE_ENV === "development" ? "http://localhost:5173" : "";

      let destination = "/";
      if (!user) {
        destination = "/?error=user_not_found";
      } else if (user.status === "disabled") {
        res.clearCookie(COOKIE_NAME, cookieOptions);
        destination = "/?error=account_disabled";
        logAuditFromReq(req, {
          userId: user.id,
          action: AuditAction.LOGIN_KAKAO_FAILED,
          metadata: { reason: "account_disabled" },
        });
      } else {
        logAuditFromReq(req, {
          userId: user.id,
          action: AuditAction.LOGIN_KAKAO,
          metadata: { status: user.status, loginMethod: "kakao" },
        });
        if (user.status === "pending") {
          destination = "/profile?setup=true";
        } else {
          destination = "/profile";
        }
      }

      res.redirect(302, `${frontendUrl}${destination}`);
    } catch (error) {
      console.error("[OAuth] 콜백 처리 실패:", error);
      logAuditFromReq(req, {
        action: AuditAction.LOGIN_KAKAO_FAILED,
        metadata: { reason: "callback_exception", error: String(error) },
      });
      const frontendUrl = process.env.NODE_ENV === "development" ? "http://localhost:5173" : "";
      res.redirect(302, `${frontendUrl}/?error=oauth_failed`);
    }
  });
}
