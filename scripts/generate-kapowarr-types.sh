#!/bin/bash
# Generate Prisma client with new Kapowarr task types

echo "🔄 Generating Prisma client with Kapowarr task types..."

# Generate Prisma client
bunx prisma generate

echo "✅ Prisma client generated successfully!"
echo ""
echo "📋 New task types added:"
echo "  - KAPOWARR_DOWNLOAD"
echo "  - KAPOWARR_SOURCE_SYNC"
echo "  - KAPOWARR_VALIDATE_SOURCE"
echo ""
echo "🔨 Next steps:"
echo "  1. Run 'bunx prisma db push' to update the database schema"
echo "  2. Test the new task handlers"
echo "  3. Update the UI to use the queue system"
