# Multi-stage build for Create React App
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --silent

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage - serve with Node.js
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Install serve globally to serve static files
RUN npm install -g serve

# Copy built app from build stage
COPY --from=build /app/build ./build

# Create a simple health check endpoint
COPY --from=build /app/package.json ./

# Install express for custom server (optional, for API routes)
RUN npm init -y && npm install express compression helmet cors

# Copy server file
COPY server.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S reactuser -u 1001
USER reactuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the server
CMD ["node", "server.js"]
