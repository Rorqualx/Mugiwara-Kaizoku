#!/bin/bash

# Script to fix catch blocks that are on a single line with code after them

echo "Fixing catch blocks in manga.ts..."

# Fix the pattern: catch (error: unknown) {const errorMessage = ...
sed -i '' 's/catch (\([^)]*\)) {const errorMessage = \(.*\);$/catch (\1) {\n      const errorMessage = \2;/g' src/server/trpc/routers/manga.ts

# Fix the pattern: catch (e: unknown) {const errorMessage = ...
sed -i '' 's/catch (e: unknown) {const errorMessage = \(.*\);$/catch (e: unknown) {\n      const errorMessage = \1;/g' src/server/trpc/routers/manga.ts

echo "Fixed catch blocks in manga.ts"
echo "Please run 'bun run type-check' to verify"