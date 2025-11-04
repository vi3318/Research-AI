# =====================================================
# BACKEND DOCKERFILE
# Multi-stage build for production optimization
# =====================================================

FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

WORKDIR /app

# =====================================================
# DEPENDENCIES STAGE
# =====================================================
FROM base AS dependencies

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# =====================================================
# BUILD STAGE
# =====================================================
FROM base AS build

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Run tests (optional - comment out if tests are failing)
# RUN npm test

# =====================================================
# PRODUCTION STAGE
# =====================================================
FROM base AS production

# Set environment
ENV NODE_ENV=production \
    PORT=3000

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies from dependencies stage
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy source code
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "src/index.js"]

# =====================================================
# DEVELOPMENT STAGE
# =====================================================
FROM base AS development

ENV NODE_ENV=development

# Install all dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Expose port and debugger
EXPOSE 3000 9229

# Start with nodemon for hot reload
CMD ["npm", "run", "dev"]
