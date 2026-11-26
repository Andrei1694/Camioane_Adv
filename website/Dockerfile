FROM node:24-trixie-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_CONTACT_EMAIL
ARG VITE_API_BASE_URL

RUN case "$VITE_API_BASE_URL" in \
      ''|https://*) ;; \
      *) echo 'VITE_API_BASE_URL must start with https:// when set for production builds.' >&2; exit 1 ;; \
    esac \
  && npm run build

FROM caddy:2-alpine

RUN addgroup -S caddy \
  && adduser -S -D -H -G caddy caddy \
  && chown -R caddy:caddy /data /config

WORKDIR /srv
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist/ /srv/

ENV PORT=8080
USER caddy
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
