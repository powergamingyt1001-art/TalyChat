#!/bin/bash
set -e

echo "=== TalyChat Vercel Build ==="

# Swap to MySQL schema for Vercel (production)
echo "Switching to MySQL schema..."
cp prisma/schema.mysql.prisma prisma/schema.prisma

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Push schema to MySQL (creates tables)
echo "Pushing schema to MySQL..."
npx prisma db push --accept-data-loss --skip-generate

# Build Next.js
echo "Building Next.js app..."
npx next build

echo "=== Vercel build complete ==="
