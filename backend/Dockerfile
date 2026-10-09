# ==========================================
# NewTEA Backend Dockerfile
# Multi-stage build for Go Fiber & GORM
# ==========================================

# Stage 1: Build binary
FROM golang:1.25-alpine AS builder

WORKDIR /build

ENV GOTOOLCHAIN=auto

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /build/server ./cmd/api

# Stage 2: Minimal runtime image
FROM alpine:3.21

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata \
    && cp /usr/share/zoneinfo/Asia/Bangkok /etc/localtime \
    && echo "Asia/Bangkok" > /etc/timezone

COPY --from=builder /build/server /app/server

# Create upload directory for course attachments
RUN mkdir -p /app/uploads/courses

EXPOSE 8080

ENV PORT=8080 \
    ENVIRONMENT=production

CMD ["/app/server"]
