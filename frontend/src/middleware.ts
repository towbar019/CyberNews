import { defineMiddleware } from "astro:middleware";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function checkBasicAuth(request: Request): boolean {
  const expectedUser = process.env.AUTH_USER;
  const expectedPass = process.env.AUTH_PASS;
  if (!expectedUser || !expectedPass) return true; // auth not configured — no-op

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;

  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
    const sepIndex = decoded.indexOf(":");
    if (sepIndex === -1) return false;
    const user = decoded.slice(0, sepIndex);
    const pass = decoded.slice(sepIndex + 1);
    return timingSafeEqual(user, expectedUser) && timingSafeEqual(pass, expectedPass);
  } catch {
    return false;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (!checkBasicAuth(context.request)) {
    return new Response("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="SecurityNews"' },
    });
  }

  const response = await next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
  );
  return response;
});
