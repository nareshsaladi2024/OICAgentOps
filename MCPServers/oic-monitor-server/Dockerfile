# Dockerfile for OIC Monitor MCP Server
FROM node:20-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build || npx tsc

# Cloud Run uses PORT environment variable (defaults to 8080)
# The server reads PORT from environment
ENV PORT=8080
ENV NODE_ENV=production

# Expose port (Cloud Run will override this)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Run the server
CMD ["node", "dist/src/index.js"]

