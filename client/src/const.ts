export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Sign-in is a same-origin server route that initiates the Google OAuth flow.
export const getLoginUrl = () => "/api/auth/google/login";
