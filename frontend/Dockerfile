# ---- build stage ----
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies first so the layer is cached across source changes.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY . .

# The API URL is baked into the bundle at build time (Vite requirement).
ARG VITE_API_BASE_URL=http://localhost:8080/api/v1
ARG VITE_APP_NAME=شلوارسرا
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_NAME=$VITE_APP_NAME

RUN npm run build

# ---- runtime stage ----
FROM nginx:1.27-alpine

RUN apk add --no-cache tzdata
ENV TZ=Asia/Tehran

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
