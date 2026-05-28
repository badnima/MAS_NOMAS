import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type express from "express";

import type {
  AuthenticatedLinkedInMember,
  AuthStatusPayload
} from "../../shared/types.js";

const LINKEDIN_AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_ACCESS_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

const LINKEDIN_SESSION_COOKIE = "mas_linkedin_session";
const LINKEDIN_STATE_COOKIE = "mas_linkedin_state";
const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10;

const LINKEDIN_SCOPES = ["openid", "profile", "email"] as const;

interface LinkedInOAuthState {
  state: string;
  createdAt: string;
}

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  id_token?: string;
  scope?: string;
}

interface LinkedInUserInfoResponse {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
  locale?: string;
}

interface StoredLinkedInSession {
  sessionId: string;
  accessToken: string;
  accessTokenExpiresAt: number;
  member: AuthenticatedLinkedInMember;
}

const linkedInSessions = new Map<string, StoredLinkedInSession>();

function getSessionSecret() {
  return process.env.APP_SESSION_SECRET ?? "";
}

function isSecureRequest(request: express.Request) {
  const forwardedProto = request.header("x-forwarded-proto");

  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim() === "https";
  }

  return request.secure || process.env.NODE_ENV === "production";
}

function resolveLinkedInRedirectUri(request: express.Request) {
  if (process.env.LINKEDIN_REDIRECT_URI) {
    return process.env.LINKEDIN_REDIRECT_URI;
  }

  if (process.env.RENDER_EXTERNAL_HOSTNAME) {
    return `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/api/auth/linkedin/callback`;
  }

  const host = request.get("host");

  if (!host) {
    return null;
  }

  const protocol = isSecureRequest(request) ? "https" : "http";
  return `${protocol}://${host}/api/auth/linkedin/callback`;
}

function isLinkedInAuthEnabled(request: express.Request) {
  return Boolean(
    process.env.LINKEDIN_CLIENT_ID &&
      process.env.LINKEDIN_CLIENT_SECRET &&
      getSessionSecret() &&
      resolveLinkedInRedirectUri(request)
  );
}

function cleanupExpiredSessions() {
  const now = Date.now();

  for (const [sessionId, session] of linkedInSessions.entries()) {
    if (session.accessTokenExpiresAt <= now) {
      linkedInSessions.delete(sessionId);
    }
  }
}

function signValue(value: string) {
  const secret = getSessionSecret();

  if (!secret) {
    throw new Error("APP_SESSION_SECRET is required for LinkedIn auth.");
  }

  return createHmac("sha256", secret).update(value).digest("base64url");
}

function createSignedValue(value: string) {
  return `${value}.${signValue(value)}`;
}

function verifySignedValue(value: string) {
  const separatorIndex = value.lastIndexOf(".");

  if (separatorIndex === -1) {
    return null;
  }

  const unsignedValue = value.slice(0, separatorIndex);
  const providedSignature = value.slice(separatorIndex + 1);
  const expectedSignature = signValue(unsignedValue);

  try {
    const providedBuffer = Buffer.from(providedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return unsignedValue;
}

function parseCookies(request: express.Request) {
  const rawCookieHeader = request.header("cookie");

  if (!rawCookieHeader) {
    return new Map<string, string>();
  }

  const entries = rawCookieHeader.split(";").map((cookie) => cookie.trim());
  const cookies = new Map<string, string>();

  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const name = entry.slice(0, separatorIndex);
    const value = entry.slice(separatorIndex + 1);
    cookies.set(name, decodeURIComponent(value));
  }

  return cookies;
}

function getSignedCookie(request: express.Request, cookieName: string) {
  const cookies = parseCookies(request);
  const rawValue = cookies.get(cookieName);

  if (!rawValue) {
    return null;
  }

  return verifySignedValue(rawValue);
}

function serializeCookie(
  request: express.Request,
  cookieName: string,
  value: string,
  maxAgeSeconds: number
) {
  const parts = [
    `${cookieName}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ];

  if (isSecureRequest(request)) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function clearCookie(request: express.Request, cookieName: string) {
  return serializeCookie(request, cookieName, "", 0);
}

function writeCookies(response: express.Response, cookies: string[]) {
  response.setHeader("Set-Cookie", cookies);
}

function encodeJsonCookiePayload(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf-8").toString("base64url");
}

function decodeJsonCookiePayload<T>(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf-8")) as T;
}

function createLinkedInSession(member: AuthenticatedLinkedInMember, accessToken: string, expiresIn: number) {
  cleanupExpiredSessions();

  const sessionId = randomUUID();
  const session: StoredLinkedInSession = {
    sessionId,
    accessToken,
    accessTokenExpiresAt: Date.now() + expiresIn * 1000,
    member
  };

  linkedInSessions.set(sessionId, session);

  return session;
}

function getLinkedInSession(request: express.Request) {
  cleanupExpiredSessions();
  const sessionId = getSignedCookie(request, LINKEDIN_SESSION_COOKIE);

  if (!sessionId) {
    return null;
  }

  return linkedInSessions.get(sessionId) ?? null;
}

function destroyLinkedInSession(request: express.Request) {
  const sessionId = getSignedCookie(request, LINKEDIN_SESSION_COOKIE);

  if (sessionId) {
    linkedInSessions.delete(sessionId);
  }
}

function getSingleQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" ? value : null;
}

function buildLinkedInAuthorizationUrl(request: express.Request, state: string) {
  const redirectUri = resolveLinkedInRedirectUri(request);
  const clientId = process.env.LINKEDIN_CLIENT_ID;

  if (!redirectUri || !clientId) {
    throw new Error("LinkedIn OAuth is not configured.");
  }

  const url = new URL(LINKEDIN_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", LINKEDIN_SCOPES.join(" "));
  url.searchParams.set("enable_extended_login", "true");

  return url.toString();
}

async function exchangeAuthorizationCode(request: express.Request, code: string) {
  const redirectUri = resolveLinkedInRedirectUri(request);
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!redirectUri || !clientId || !clientSecret) {
    throw new Error("LinkedIn OAuth is missing required configuration.");
  }

  const response = await fetch(LINKEDIN_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    })
  });

  if (!response.ok) {
    throw new Error(`LinkedIn token exchange failed with status ${response.status}.`);
  }

  return (await response.json()) as LinkedInTokenResponse;
}

async function fetchAuthenticatedMemberProfile(accessToken: string) {
  const response = await fetch(LINKEDIN_USERINFO_URL, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`LinkedIn userinfo request failed with status ${response.status}.`);
  }

  const profile = (await response.json()) as LinkedInUserInfoResponse;

  return {
    subject: profile.sub,
    name: profile.name,
    givenName: profile.given_name,
    familyName: profile.family_name,
    picture: profile.picture,
    email: profile.email,
    emailVerified: profile.email_verified,
    locale: profile.locale,
    connectedAt: new Date().toISOString()
  } satisfies AuthenticatedLinkedInMember;
}

function redirectToMasRoot(response: express.Response, status: "connected" | "signed_out" | "error", detail?: string) {
  const url = new URL("/", "http://mas.local");

  if (status === "connected") {
    url.searchParams.set("linkedin", "connected");
  } else if (status === "signed_out") {
    url.searchParams.set("linkedin", "signed_out");
  } else {
    url.searchParams.set("linkedin_error", detail ?? "unknown_error");
  }

  response.redirect(url.pathname + url.search);
}

export function getLinkedInAuthStatus(request: express.Request): AuthStatusPayload {
  const authEnabled = isLinkedInAuthEnabled(request);
  const session = authEnabled ? getLinkedInSession(request) : null;

  return {
    authEnabled,
    member: session?.member ?? null
  };
}

export function startLinkedInAuth(request: express.Request, response: express.Response) {
  if (!isLinkedInAuthEnabled(request)) {
    redirectToMasRoot(response, "error", "linkedin_not_configured");
    return;
  }

  const state = randomUUID();
  const oauthState: LinkedInOAuthState = {
    state,
    createdAt: new Date().toISOString()
  };

  writeCookies(response, [
    serializeCookie(
      request,
      LINKEDIN_STATE_COOKIE,
      createSignedValue(encodeJsonCookiePayload(oauthState)),
      OAUTH_STATE_MAX_AGE_SECONDS
    )
  ]);

  response.redirect(buildLinkedInAuthorizationUrl(request, state));
}

export async function handleLinkedInCallback(request: express.Request, response: express.Response) {
  if (!isLinkedInAuthEnabled(request)) {
    redirectToMasRoot(response, "error", "linkedin_not_configured");
    return;
  }

  const linkedInError = getSingleQueryValue(request.query.error);

  if (linkedInError) {
    writeCookies(response, [clearCookie(request, LINKEDIN_STATE_COOKIE)]);
    redirectToMasRoot(response, "error", linkedInError);
    return;
  }

  const code = getSingleQueryValue(request.query.code);
  const returnedState = getSingleQueryValue(request.query.state);
  const stateCookiePayload = getSignedCookie(request, LINKEDIN_STATE_COOKIE);

  if (!code || !returnedState || !stateCookiePayload) {
    writeCookies(response, [clearCookie(request, LINKEDIN_STATE_COOKIE)]);
    redirectToMasRoot(response, "error", "missing_oauth_state");
    return;
  }

  const savedState = decodeJsonCookiePayload<LinkedInOAuthState>(stateCookiePayload);

  if (savedState.state !== returnedState) {
    writeCookies(response, [clearCookie(request, LINKEDIN_STATE_COOKIE)]);
    redirectToMasRoot(response, "error", "state_mismatch");
    return;
  }

  const tokens = await exchangeAuthorizationCode(request, code);
  const member = await fetchAuthenticatedMemberProfile(tokens.access_token);
  const session = createLinkedInSession(member, tokens.access_token, tokens.expires_in);

  destroyLinkedInSession(request);

  writeCookies(response, [
    clearCookie(request, LINKEDIN_STATE_COOKIE),
    serializeCookie(
      request,
      LINKEDIN_SESSION_COOKIE,
      createSignedValue(session.sessionId),
      tokens.expires_in
    )
  ]);

  redirectToMasRoot(response, "connected");
}

export function logoutLinkedInAuth(request: express.Request, response: express.Response) {
  destroyLinkedInSession(request);
  writeCookies(response, [clearCookie(request, LINKEDIN_SESSION_COOKIE)]);
  response.status(204).end();
}
