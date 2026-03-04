import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import type { SessionPayload } from "@/lib/types";

const SESSION_COOKIE = "couple_budget_session";
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 7;
const jwtSecret = new TextEncoder().encode(env.AUTH_SECRET);

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    username: payload.username,
    name: payload.name,
    householdId: payload.householdId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_AGE_SECONDS}s`)
    .sign(jwtSecret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const verified = await jwtVerify(token, jwtSecret);
    const payload = verified.payload;

    if (!payload.sub || !payload.username || !payload.name || !payload.householdId) {
      return null;
    }

    return {
      userId: payload.sub,
      username: String(payload.username),
      name: String(payload.name),
      householdId: String(payload.householdId),
    };
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export function applySessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
