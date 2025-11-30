# Unified Dockerfile for MCP Servers
# Build from project root context
FROM node:20-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy oic-monitor-server files (build context is project root)
COPY MCPServers/oic-monitor-server/package*.json ./
COPY MCPServers/oic-monitor-server/tsconfig.json ./

# Install all dependencies (including devDependencies for TypeScript build)
RUN npm ci

# Copy source files
COPY MCPServers/oic-monitor-server/src/ ./src/

# Build TypeScript
RUN npm run build

# Remove devDependencies after build to reduce image size
RUN npm prune --production

# Set environment variables
ENV PORT=3000
ENV NODE_ENV=production

# Expose port (using 3000 to avoid conflict with kaggle-5-day-agents on 8080)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Run the server
CMD ["node", "dist/src/index.js"]

