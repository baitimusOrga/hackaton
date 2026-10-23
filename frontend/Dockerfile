# Frontend image: Angular build served by unprivileged nginx on :8080 (context frontend/).
FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY . .
RUN npx ng build --configuration production

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 docker/40-config-json.sh /docker-entrypoint.d/40-config-json.sh
COPY --from=build /src/dist/frontend/browser /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
