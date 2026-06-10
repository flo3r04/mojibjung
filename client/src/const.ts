export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const getApiOrigin = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.location.port === "5173"
  ) {
    return "http://localhost:3000";
  }
  return window.location.origin;
};
 
// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const kakaoClientId = import.meta.env.VITE_KAKAO_CLIENT_ID;
  const redirectUri = `${getApiOrigin()}/api/oauth/callback`;
  const state = btoa(redirectUri);
 
  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("client_id", kakaoClientId || "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
 
  return url.toString();
};
