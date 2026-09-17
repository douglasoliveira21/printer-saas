FROM node:22-alpine AS base
WORKDIR /repo

FROM base AS build
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared packages/shared
RUN npm ci --workspace=apps/api --include-workspace-root
COPY apps/api apps/api
RUN npm run prisma:generate --workspace=apps/api
RUN npm run build --workspace=apps/api

FROM base AS runtime
ENV NODE_ENV=production
# Reuse the full node_modules built above (includes packages/shared/dist,
# already compiled with its own devDependencies available) instead of
# running a second `npm ci --omit=dev` here — that would re-trigger the
# root "postinstall" (which builds packages/shared) without `typescript`
# installed, breaking the build. Simpler and correct beats a smaller image.
COPY --from=build /repo/node_modules node_modules
# node_modules/@printer-saas/shared is a workspace SYMLINK to ../../packages/shared
# (npm workspaces), so the actual package directory must be copied too, or
# the symlink dangles and `require('@printer-saas/shared')` fails at runtime.
COPY --from=build /repo/packages/shared packages/shared
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY --from=build /repo/apps/api/package.json apps/api/package.json

WORKDIR /repo/apps/api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main.js"]
