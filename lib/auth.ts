import { createHmac, timingSafeEqual } from "crypto";
import { cookies, type ReadonlyRequestCookies } from "next/headers";

const AUTH_COOKIE_NAME = "comfyui_remote_session";
const SESSION_KEY = "comfyui-remote-session";
const DEFAULT_PASSWORD = "changeme";
const DEFAULT_SECRET = "development-secret";

const isProduction = process.env.NODE_ENV === "production";

function getSecret() {
  return process.env.AUTH_SECRET || DEFAULT_SECRET;
}

export function getConfiguredPassword() {
  return process.env.APP_PASSWORD || DEFAULT_PASSWORD;
}

export function isPasswordConfigured() {
  return Boolean(process.env.APP_PASSWORD);
}

function signSession() {
  return createHmac("sha256", getSecret()).update(SESSION_KEY).digest("hex");
}

export function getSessionToken() {
  return signSession();
}

export function verifySessionToken(token?: string | null) {
  if (!token) return false;

  const expected = signSession();

  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function readIsAuthenticated(
  cookieStore?: ReadonlyRequestCookies | Promise<ReadonlyRequestCookies>,
): Promise<boolean> {
  const store = cookieStore ? await cookieStore : await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;

  return verifySessionToken(token);
}

export async function setSessionCookie() {
  const store = await cookies();

  store.set({
    name: AUTH_COOKIE_NAME,
    value: signSession(),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isProduction,
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(AUTH_COOKIE_NAME);
}

export { AUTH_COOKIE_NAME };
