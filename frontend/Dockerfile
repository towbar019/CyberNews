FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY astro.config.mjs ./
COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/

# Build args for env vars needed at build time
ARG DATABASE_URL
ARG PUBLIC_API_URL
ENV DATABASE_URL=$DATABASE_URL
ENV PUBLIC_API_URL=$PUBLIC_API_URL

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
