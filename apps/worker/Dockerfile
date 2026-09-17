FROM node:22-alpine AS base
WORKDIR /repo

FROM base AS build
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared packages/shared
RUN npm ci --workspace=apps/worker --include-workspace-root
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
RUN npx --yes prisma@6.19.3 generate --schema apps/api/prisma/schema.prisma
COPY apps/worker apps/worker
RUN npm run build --workspace=apps/worker

FROM base AS runtime
ENV NODE_ENV=production
# See apps/api/Dockerfile for why this reuses node_modules from the build
# stage wholesale instead of a second `npm ci --omit=dev` here.
COPY --from=build /repo/node_modules node_modules
# node_modules/@printer-saas/shared is a workspace SYMLINK to ../../packages/shared
# (npm workspaces) — copy the real directory too or the symlink dangles.
COPY --from=build /repo/packages/shared packages/shared
COPY --from=build /repo/apps/worker/dist apps/worker/dist
COPY --from=build /repo/apps/worker/package.json apps/worker/package.json

WORKDIR /repo/apps/worker
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main.js"]
