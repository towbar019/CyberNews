import { defineMiddleware } from "astro:middleware";

/**
 * Security headers middleware — voir security review 2026-06-09 (OWASP A05).
 * CSP note : 'unsafe-inline' est nécessaire pour les styles Astro scoped et
 * les React islands hydratés. script-src reste sans unsafe-inline sauf pour
 * les modules Astro (hashés au build) — on autorise 'unsafe-inline' script
 * uniquement car Astro injecte des inline module scripts pour l'hydratation.
 */
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Astro island hydration inline scripts
      "style-src 'self' 'unsafe-inline'",  // Astro scoped styles + React inline styles
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  return response;
});
