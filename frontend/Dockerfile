FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY astro.config.mjs ./
COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/

# SECURITY: DATABASE_URL n'est plus injecté au build (leak dans l'image +
# vite.define supprimé). Il est fourni au runtime via env_file.
RUN npm run build

# Production
FROM node:22-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", "./dist/server/entry.mjs"]
