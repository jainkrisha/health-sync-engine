# Builds the PWA and serves it with nginx, which also proxies /api and /socket.io
# to the server container so the browser only ever talks to one origin.
# Build context is the repository root (the client imports ../shared).
FROM node:22-alpine AS build
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci
COPY shared ./shared
COPY client ./client
RUN cd client && npm run build

FROM nginx:1.27-alpine
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
