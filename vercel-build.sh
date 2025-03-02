#!/bin/bash

# Output all commands to the logs
set -x

# Push schema changes to the database, accepting data loss if necessary
npx prisma db push --accept-data-loss

# Generate Prisma client
npx prisma generate

# Build the Next.js application
next build 