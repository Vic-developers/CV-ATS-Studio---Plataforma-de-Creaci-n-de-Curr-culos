import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const nonce = randomBytes(18).toString("base64");
  const dev = process.env.NODE_ENV !== "production";
  const policy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'nonce-" + nonce + "'" + (dev ? " 'unsafe-eval'" : ""),
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "frame-src 'self' blob:",
    "connect-src 'self'" + (dev ? " ws: wss:" : ""),
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/", "/recuperar"] };
