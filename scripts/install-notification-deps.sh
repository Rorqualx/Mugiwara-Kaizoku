#!/bin/bash
# Install notification service dependencies

echo "Installing notification service dependencies..."

# Add the new dependencies
bun add nodemailer@^6.9.8 @slack/webhook@^7.0.2
bun add -D @types/nodemailer@^6.4.14

echo "Dependencies installed successfully!"

echo ""
echo "Next steps:"
echo "1. Run database migration to add notifications field: bun run migrate"
echo "2. Start the development server: bun run dev"
echo "3. Navigate to /settings/integrations/notifications to configure providers"
echo ""
echo "For more information, see docs/notification-service-implementation.md"
