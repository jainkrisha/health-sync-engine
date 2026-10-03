# Build context is the repository root (the server bundles ../shared).
FROM node:22-alpine AS build
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci
COPY shared ./shared
COPY server ./server
RUN cd server && npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY --from=build /app/server/package.json ./
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "dist/index.js"]
