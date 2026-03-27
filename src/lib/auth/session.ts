import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const secret = process.env.AUTH_SECRET;

if (!secret) {
  throw new Error("AUTH_SECRET is required.");
}

const secretKey = new TextEncoder().encode(secret);

export const SESSION_COOKIE_NAME = "parking_session";

export type SessionPayload = JWTPayload & {
  userId: string;
  role: "ADMIN" | "OPERATOR";
  name: string;
  email: string;
};

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifySessionToken(token?: string) {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    return payload as SessionPayload;
  } catch {
    return null;
  }
}
