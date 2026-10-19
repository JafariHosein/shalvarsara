# ---- build stage ----
FROM golang:1.23-alpine AS build

WORKDIR /src

# git is needed by some module fetches; ca-certificates for TLS.
RUN apk add --no-cache git ca-certificates

# Cache dependencies independently of source changes.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath -ldflags="-s -w" \
    -o /out/api ./cmd/api

# ---- runtime stage ----
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata wget
ENV TZ=Asia/Tehran

WORKDIR /app

# Run as an unprivileged user.
RUN adduser -D -u 10001 appuser
COPY --from=build /out/api /app/api
USER appuser

# The app reads PORT (default 8080) — Render, Heroku and friends inject their
# own. EXPOSE is documentation only, so it stays on the default.
EXPOSE 8080

# Shell form on purpose: the check has to expand $PORT at run time. `wget -qO-`
# also fails the build if the port never opens, which is what we want.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/api/v1/health" || exit 1

ENTRYPOINT ["/app/api"]
