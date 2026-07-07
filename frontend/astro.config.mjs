import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";

// SECURITY: ne JAMAIS remettre vite.define pour DATABASE_URL — cela substitue
// la connection string (credentials inclus) dans TOUS les modules bundlés,
// y compris potentiellement du code client. Le code server-side Astro accède
// à process.env nativement au runtime.
export default defineConfig({
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  integrations: [react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
});
