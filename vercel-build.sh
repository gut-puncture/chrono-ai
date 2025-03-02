#!/bin/bash

# Output all commands to the logs
set -x

# Set NODE_ENV explicitly
export NODE_ENV=production

# Push schema changes to the database, accepting data loss if necessary
# Use --skip-generate for efficiency
npx prisma db push --skip-generate --accept-data-loss

# Generate Prisma client
npx prisma generate

# Build the Next.js application with increased memory limit
NODE_OPTIONS="--max-old-space-size=4096" next build 