#!/bin/bash
set -e

echo "=== TalyChat Build ==="
echo "Generating Prisma client..."
npx prisma generate

echo "Building Next.js app..."
npx next build

echo "=== Build complete ==="
