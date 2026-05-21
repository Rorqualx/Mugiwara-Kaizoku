# Home Page Components

Netflix-style horizontal scrolling components for displaying manga on the home page.

## Components

### MangaRowCard

A compact manga card optimized for horizontal scrolling rows.

**Features:**
- Compact size: 180px × 270px (desktop), 150px × 225px (mobile)
- Cover image with gradient overlay
- Chapter count badge with icon
- Status badge with color coding
- Hover effect: scale(1.05) with smooth transition
- Responsive sizing

**Usage:**
```tsx
import { MangaRowCard } from '@/components/home';

<MangaRowCard
  manga={{
    id: 1,
    title: "One Piece",
    metadata: {
      cover: "/covers/one-piece.jpg",
      status: "RELEASING"
    },
    _count: {
      chapters: 1089
    }
  }}
  onClick={() => router.push(`/manga/1`)}
/>
```

### MangaRow

A horizontal scrolling row container with navigation arrows.

**Features:**
- Section title with optional "View All" link
- Native CSS scroll-snap for smooth scrolling
- Left/right arrow navigation (desktop only)
- Touch/swipe support for mobile
- Responsive: 2-6 cards per view
- Skeleton loading state
- Empty state handling
- Hidden scrollbar with full functionality

**Usage:**
```tsx
import { MangaRow } from '@/components/home';

<MangaRow
  title="Recently Added"
  manga={[
    {
      id: 1,
      title: "One Piece",
      metadata: {
        cover: "/covers/one-piece.jpg",
        status: "RELEASING"
      },
      _count: { chapters: 1089 }
    },
    // ... more manga
  ]}
  viewAllHref="/manga/recent"
  loading={false}
  emptyMessage="No recently added manga"
/>
```

## Responsive Behavior

### Desktop (≥1200px)
- Shows 6 cards per view
- Card size: 180px × 270px
- Navigation arrows visible on hover

### Tablet (768px - 1199px)
- Shows 4-5 cards per view
- Card size: 180px × 270px
- Navigation arrows visible

### Mobile (<768px)
- Shows 2-3 cards per view
- Card size: 150px × 225px
- Touch/swipe navigation only (no arrows)

## Performance Optimizations

- **useMemo** for card list rendering
- **ResizeObserver** for efficient container size tracking
- **Scroll event debouncing** via browser optimizations
- **Skeleton loading** prevents layout shift
- **scroll-snap** for smooth, native scrolling

## Accessibility

- **ARIA labels** on navigation buttons
- **Keyboard navigation** support
- **Focus management** for interactive elements
- **Semantic HTML** structure
- **Color contrast** compliance for badges

## Type Safety

Both components use TypeScript with strict null checking:

```typescript
interface MangaRowCardProps {
  manga: {
    id: number;
    title: string;
    metadata?: {
      cover?: string;
      coverMedium?: string;
      status?: string;
    } | null;
    _count?: {
      chapters: number;
    };
  };
  onClick?: () => void;
}

interface MangaRowProps {
  title: string;
  manga: Array<MangaRowCardProps['manga']>;
  viewAllHref?: string;
  loading?: boolean;
  emptyMessage?: string;
}
```

## Mantine v7 Compliance

All components use Mantine v7 props:
- `fw` instead of `weight`
- `gap` instead of `spacing`
- `justify` instead of `position`
- `c` instead of `color` (for text)
- `ta` instead of `align` (for text alignment)

## Example: Full Home Page

```tsx
import { MangaRow } from '@/components/home';
import { trpc } from '@/utils/trpc';

export function HomePage() {
  const { data: recentManga, isLoading: loadingRecent } =
    trpc.manga.getRecent.useQuery({ limit: 12 });

  const { data: popularManga, isLoading: loadingPopular } =
    trpc.manga.getPopular.useQuery({ limit: 12 });

  return (
    <div>
      <MangaRow
        title="Recently Added"
        manga={recentManga ?? []}
        loading={loadingRecent}
        viewAllHref="/manga/recent"
        emptyMessage="No recently added manga"
      />

      <MangaRow
        title="Most Popular"
        manga={popularManga ?? []}
        loading={loadingPopular}
        viewAllHref="/manga/popular"
        emptyMessage="No popular manga found"
      />
    </div>
  );
}
```

## Status Badge Colors

The `MangaRowCard` automatically assigns colors based on manga status:

- **Green** - "RELEASING", "ONGOING"
- **Blue** - "FINISHED", "COMPLETED"
- **Yellow** - "HIATUS"
- **Red** - "CANCELLED"
- **Gray** - Unknown or other statuses

## Technical Notes

1. **No External Dependencies**: Uses native CSS scroll-snap instead of embla-carousel
2. **Browser Support**: Modern browsers with ResizeObserver support
3. **SSR Compatible**: No window/document references during render
4. **Performance**: Optimized for 100+ manga cards per page

## Future Enhancements

Potential improvements for future iterations:

- [ ] Virtualization for very long rows (1000+ items)
- [ ] Keyboard arrow key navigation
- [ ] Drag-to-scroll on desktop
- [ ] Infinite scrolling within rows
- [ ] Custom scroll animations
- [ ] More detailed hover previews

---

*Created: 2025-10-17*
*Last Updated: 2025-10-17*
