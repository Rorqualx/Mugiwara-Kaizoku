# Wanted Pages Setup Instructions

## Quick Start

Follow these steps to set up and use the wanted pages functionality:

### 1. Database Setup

First, ensure your database has the new tables:

```bash
# Generate Prisma client with new models
bun run generate

# Push schema to database (creates new tables)
bun run wanted:setup

# OR manually run:
bunx prisma db push
```

### 2. Add Test Data (Optional)

To see the functionality in action with sample data:

```bash
# Seed test data for wanted functionality
bun run wanted:seed
```

This will create:
- Sample wanted items
- Download history entries
- Blocklist entries

### 3. Start the Application

```bash
# Start development server
bun run dev
```

### 4. Access the Wanted Pages

Navigate to these URLs:
- **Missing Items**: http://localhost:3000/wanted/missing
- **Latest Downloads**: http://localhost:3000/wanted/downloads
- **Blocklist**: http://localhost:3000/wanted/blocklist

## Features

### Missing Items Page
- Shows manga with missing chapters
- Compares actual vs expected chapters from metadata
- Add missing items to wanted list with one click

### Downloads Page
- Recent download activity
- Success/failure statistics
- Download size and speed metrics
- Filter by status and date

### Blocklist Page
- Manage blocked manga/chapters/sources
- Set expiry dates for temporary blocks
- Categorize blocks by reason
- Toggle active/inactive status

## Using the Hooks

The implementation includes custom hooks for easy integration:

```typescript
import { useWantedItems, useDownloadHistory, useBlocklist } from '@/hooks/useWanted';

// In your component
const { 
  wantedItems, 
  missingItems, 
  addToWanted, 
  searchNow 
} = useWantedItems();

const { 
  entries, 
  stats 
} = useDownloadHistory();

const { 
  entries, 
  isBlocked, 
  add, 
  remove 
} = useBlocklist();
```

## Widget Component

Add the summary widget to your dashboard:

```typescript
import { WantedSummaryWidget } from '@/components/wanted/WantedSummaryWidget';

// In your dashboard
<WantedSummaryWidget />
```

## Troubleshooting

### Tables Not Created
If the tables aren't created:
1. Check your DATABASE_URL in .env
2. Ensure PostgreSQL is running
3. Run `bun run generate` then `bunx prisma db push`

### No Data Showing
1. Run `bun run wanted:seed` to add test data
2. Ensure you have manga in your library first
3. Check browser console for errors

### TypeScript Errors
1. Run `bun run generate` to update Prisma types
2. Restart TypeScript server in VS Code
3. Check that all imports use relative paths

## Next Steps

To fully integrate with download functionality:
1. Connect to actual download clients (Transmission, NZBGet)
2. Implement background job processing for searches
3. Add notification support for found items
4. Integrate with existing download queue system

## API Endpoints

The tRPC router provides these procedures:
- `wanted.getMissing` - Get missing items
- `wanted.getWanted` - Get wanted list with filters
- `wanted.addToWanted` - Add item to wanted list
- `wanted.updateWanted` - Update priority/status
- `wanted.removeFromWanted` - Remove from list
- `wanted.searchNow` - Trigger search for items
- `wanted.getHistory` - Get download history
- `wanted.getBlocklist` - Get blocklist entries
- `wanted.addToBlocklist` - Add to blocklist
- `wanted.removeFromBlocklist` - Remove from blocklist
- `wanted.toggleBlocklistActive` - Toggle active state

## Development Notes

- All enums use UPPERCASE values (e.g., `PENDING`, not `pending`)
- IDs are converted using `toNumberId()` before database operations
- All pages follow the AsyncResult pattern for error handling
- Icons are imported directly from `@tabler/icons-react`
- No wrapper files or alias imports are used
