# syntax=docker/dockerfile:1
# Multi-stage build for the Express/TypeScript server
# Stage 1: install deps + compile TypeScript using the project's own tsconfig
# Stage 2: lean production image — compiled JS only, no source files, no devDeps

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:26-alpine AS builder

WORKDIR /app

# Copy workspace manifests first to maximise layer cache reuse.
# npm install only re-runs when these files change.
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY tsconfig.base.json ./

# Install ALL workspace dependencies (dev + prod) at the root so that
# workspace hoisting places node_modules/ at /app/node_modules/ and tsc is
# available as /app/node_modules/.bin/tsc.
RUN npm ci

# Copy server source AFTER installing deps to keep the install layer cached.
COPY server/src ./server/src
COPY server/tsconfig.json ./server/

# Compile TypeScript using the project's own server/tsconfig.json so that
# module/moduleResolution settings are honoured exactly as in local dev.
RUN npm run build --workspace=server

# ── Stage 2: production ───────────────────────────────────────────────────────
FROM node:26-alpine AS production

WORKDIR /app

# Copy compiled JS output from the builder stage.
COPY --from=builder /app/server/dist ./dist

# Copy the server package manifest AND the root lockfile so that
# `npm ci --omit=dev` uses the exact same dependency versions as CI.
COPY server/package.json ./
COPY package-lock.json ./

# Install production dependencies only, using the lockfile for reproducibility.
RUN npm ci --omit=dev

# Drop the lockfile after install — it's not needed at runtime.
RUN rm package-lock.json

# Run as a non-root user for defence-in-depth.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

# ECS/Fargate injects all env vars — dotenv is not used in production.
CMD ["node", "dist/index.js"]
