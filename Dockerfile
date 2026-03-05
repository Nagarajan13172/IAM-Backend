# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Dependencies
#   Install only production node_modules in an isolated layer so the final
#   image stays lean and doesn't carry devDependencies or build cache.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy manifest files first to leverage Docker layer caching
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --omit=dev

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Runner
#   Copy source + pre-built node_modules into a fresh, minimal image.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy production dependencies from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source code
COPY . .

# Change ownership to the non-root user
RUN chown -R appuser:appgroup /app

USER appuser

# Expose the port the Express server listens on (default: 5000)
EXPOSE 5000

# Health check — hits the root health-check route
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/ || exit 1

# Start the server
CMD ["node", "server.js"]
