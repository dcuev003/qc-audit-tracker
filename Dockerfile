# ============================================
# QC Audit Tracker - Development Environment
# ============================================
# This Docker image provides a complete development environment
# for working with the QC Audit Tracker Chrome Extension codebase.
#
# Usage:
#   docker build -t qc-audit-tracker .
#   docker run -it qc-audit-tracker
#
# Or with docker-compose:
#   docker-compose up
# ============================================

FROM node:22-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Install git for any git operations needed
RUN apk add --no-cache git

# Copy package files first for better layer caching
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the entire codebase
COPY . .

# Build the extension to verify setup works
RUN pnpm build

# Run tests to verify everything is working
RUN pnpm test:run

# Default command - start an interactive shell
CMD ["sh"]
