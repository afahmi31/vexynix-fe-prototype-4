FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Add runtime env vars (injected at container startup)
ARG BFF_ORIGIN=http://localhost:18080
ARG APP_ENV=production
ARG FEATURE_FLAGS

# Copy entrypoint script for runtime env injection
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# public/ MUST be chowned to nextjs: the entrypoint writes public/__ENV.js at
# startup as USER nextjs. Without --chown the dir stays root-owned and the write
# fails with "Permission denied", crashing the container on boot.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use entrypoint for runtime env injection
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
