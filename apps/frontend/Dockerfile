FROM node:22-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared packages/shared
RUN npm ci --workspace=apps/frontend --include-workspace-root

FROM deps AS build
COPY apps/frontend apps/frontend
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build --workspace=apps/frontend

FROM base AS runtime
ENV NODE_ENV=production
# Next.js standalone server.js only binds to HOSTNAME if it's set — without
# it, some versions bind to localhost/127.0.0.1 inside the container, which
# passes this Dockerfile's own HEALTHCHECK (runs inside the container's
# network namespace) but is unreachable from EasyPanel's reverse proxy
# (connects via the container's internal IP, not localhost).
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Monorepo standalone output nests server.js at apps/frontend/apps/frontend/server.js
# (mirrors the workspace-relative path) — public/ has to sit right next to it,
# not one level up, or static assets like /logo.png 404 at runtime.
COPY --from=build /repo/apps/frontend/public apps/frontend/apps/frontend/public
COPY --from=build /repo/apps/frontend/.next/standalone apps/frontend
COPY --from=build /repo/apps/frontend/.next/static apps/frontend/apps/frontend/.next/static

WORKDIR /repo/apps/frontend
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "apps/frontend/server.js"]
