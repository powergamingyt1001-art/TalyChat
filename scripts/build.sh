#!/bin/bash
set -e

echo "=== TalyChat Build Script ==="

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Create the database and push schema
echo "Creating SQLite database..."
mkdir -p db
export DATABASE_URL="file:./db/custom.db"
npx prisma db push --accept-data-loss --skip-generate

# Build Next.js
echo "Building Next.js app..."
npx next build

echo "=== Build complete ==="
