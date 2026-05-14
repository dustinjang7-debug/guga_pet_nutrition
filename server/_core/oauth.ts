import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getOrigin(req: Request): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = (Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto?.split(",")[0]?.trim()) || req.protocol;
  const host = req.get("host");
  return `${proto}://${host}`;
}

function getRedirectUri(req: Request): string {
  return `${getOrigin(req)}/api/auth/google/callback`;
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

type StatePayload = { n: string; r: string; t: number };

function signState(payload: StatePayload): string {
  const secret = ENV.cookieSecret || "";
  const body = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const sig = base64UrlEncode(
    crypto.createHmac("sha256", secret).update(body).digest()
  );
  return `${body}.${sig}`;
}

function verifyState(state: string): StatePayload | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const secret = ENV.cookieSecret || "";
  const expected = base64UrlEncode(
    crypto.createHmac("sha256", secret).update(body).digest()
  );
  // timing-safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(body).toString("utf8")) as StatePayload;
    if (!payload || typeof payload.t !== "number") return null;
    if (Date.now() - payload.t > STATE_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

function safeRedirectPath(input: string | undefined | null): string {
  if (!input || typeof input !== "string") return "/";
  // Only allow same-origin paths.
  if (!input.startsWith("/") || input.startsWith("//")) return "/";
  return input;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/auth/google/login", (req: Request, res: Response) => {
    if (!ENV.googleClientId || !ENV.googleClientSecret) {
      res.status(500).send("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
      return;
    }

    const redirectPath = safeRedirectPath(getQueryParam(req, "redirect"));
    const state = signState({
      n: crypto.randomBytes(16).toString("hex"),
      r: redirectPath,
      t: Date.now(),
    });

    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", ENV.googleClientId);
    url.searchParams.set("redirect_uri", getRedirectUri(req));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "select_account");

    res.redirect(302, url.toString());
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const error = getQueryParam(req, "error");

    if (error) {
      res.status(400).send(`Google OAuth error: ${error}`);
      return;
    }

    if (!code || !state) {
      res.status(400).send("code and state are required");
      return;
    }

    const verified = verifyState(state);
    if (!verified) {
      res.status(400).send("Invalid or expired state");
      return;
    }

    try {
      const tokenBody = new URLSearchParams({
        code,
        client_id: ENV.googleClientId,
        client_secret: ENV.googleClientSecret,
        redirect_uri: getRedirectUri(req),
        grant_type: "authorization_code",
      });

      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody.toString(),
      });

      if (!tokenRes.ok) {
        const text = await tokenRes.text();
        console.error("[OAuth] Token exchange failed", tokenRes.status, text);
        res.status(502).send("Failed to exchange code for token");
        return;
      }

      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        id_token?: string;
      };

      if (!tokenJson.access_token) {
        res.status(502).send("No access_token in Google response");
        return;
      }

      const userRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });

      if (!userRes.ok) {
        const text = await userRes.text();
        console.error("[OAuth] userinfo failed", userRes.status, text);
        res.status(502).send("Failed to fetch userinfo");
        return;
      }

      const profile = (await userRes.json()) as {
        sub?: string;
        name?: string;
        email?: string;
        email_verified?: boolean;
        picture?: string;
      };

      if (!profile.sub) {
        res.status(502).send("Google profile missing sub");
        return;
      }

      await db.upsertUser({
        openId: profile.sub,
        name: profile.name || null,
        email: profile.email ?? null,
        picture: profile.picture ?? null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(profile.sub, {
        name: profile.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      res.redirect(302, verified.r || "/");
    } catch (err) {
      console.error("[OAuth] Callback failed", err);
      res.status(500).send("OAuth callback failed");
    }
  });
}
