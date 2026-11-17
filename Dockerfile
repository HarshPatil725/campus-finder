# =========================================================================
# Multi-Stage / Lightweight Production Dockerfile for Campus Wi-Fi Tracker
# Runtime: Node.js 20 LTS on Alpine Linux
# =========================================================================

FROM node:20-alpine

# Install dumb-init for proper signal handling and PID 1 zombie reaper
RUN apk add --no-cache dumb-init

# Set application working directory
WORKDIR /usr/src/app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Copy package manifests first to leverage Docker layer caching
COPY package.json package-lock.json ./

# Install only production dependencies cleanly from package-lock.json
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source directories with node user ownership
COPY --chown=node:node backend ./backend
COPY --chown=node:node public ./public
COPY --chown=node:node database ./database

# Enforce least-privilege by running as built-in non-root 'node' user
USER node

# Expose internal Express application port
EXPOSE 3000

# Container healthcheck querying the /api/health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Use dumb-init as entrypoint to manage SIGTERM / SIGINT gracefully
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Default start command launches the Express backend
CMD ["node", "backend/server.js"]
