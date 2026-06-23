# Calendar Feature - User Guide

## Overview

The Mugiwara-Kaizoku Calendar feature provides intelligent manga release tracking with predictive capabilities. It automatically detects release patterns and notifies you of upcoming chapters.

## Features

### 📅 Calendar View
- **Monthly View**: See all scheduled releases for the month
- **Weekly View**: Focus on the current week's releases
- **List View**: Mobile-friendly list of upcoming releases
- **Agenda View**: Detailed list with all event information

### 🔮 Predictive Release Detection
The calendar automatically analyzes release patterns to predict future chapters:
- **Weekly releases**: Detects consistent weekly patterns (e.g., every Monday)
- **Bi-weekly releases**: Identifies releases every two weeks
- **Monthly releases**: Tracks monthly publication schedules
- **Irregular releases**: Handles manga with inconsistent schedules

### 🎯 Confidence Indicators
Each predicted release shows a confidence level:
- **High confidence (80-100%)**: Solid border, full opacity
- **Medium confidence (60-79%)**: Dashed border, medium opacity
- **Low confidence (< 60%)**: Dotted border, low opacity

## Getting Started

### Enabling Calendar Monitoring

1. Navigate to a manga's detail page
2. Click the **Calendar** tab
3. Toggle **"Monitor for releases"**
4. The system will analyze past chapters and detect patterns

### Viewing the Calendar

1. Click **Calendar** in the main navigation
2. Use the view selector to switch between Month, Week, List, or Agenda views
3. Navigate using:
   - Arrow buttons to move between periods
   - "Today" button to return to current date
   - Date picker for specific dates

## Calendar Controls

### Filtering Options

Click the **Filter** button to access:

- **Manga Selection**: Show only specific manga
- **Event Types**: Filter by release type (chapters, volumes, announcements)
- **Status Filter**: Show scheduled, confirmed, or delayed releases
- **Confidence Level**: Set minimum confidence threshold
- **Date Range**: Custom date range selection

### Color Schemes

Switch between color modes using the palette button:
- **Status-based**: Colors indicate event status (scheduled, confirmed, delayed)
- **Manga-based**: Each manga gets a unique color
- **Confidence-based**: Colors reflect prediction confidence

### Export Options

Export your calendar data via the **Export** button:
- **iCal (.ics)**: Import into calendar apps (Google Calendar, Outlook, Apple Calendar)
- **CSV**: Spreadsheet-compatible format
- **JSON**: Developer-friendly data format
- **RSS Feed**: Subscribe to updates in feed readers

## Event Management

### Viewing Event Details

Click any event to see:
- Manga title and chapter number
- Scheduled vs actual release date
- Confidence level
- Release pattern information
- Source of prediction

### Manual Adjustments

For events you've confirmed:
1. Click the event
2. Select **"Mark as Confirmed"**
3. Optionally adjust the date if needed

### Handling Delays

When a release doesn't arrive on schedule:
- The system automatically marks it as delayed after 24 hours
- You'll receive a notification about the delay
- The event color changes to indicate delay status

## Notifications

### Notification Types

- **Upcoming Releases**: Daily notification for next day's releases
- **New Releases**: When a predicted chapter is actually released
- **Delays**: When an expected release is late
- **Pattern Changes**: When release schedules change

### Customizing Notifications

1. Go to **Settings** → **Notifications**
2. Configure:
   - Notification timing (how far in advance)
   - Minimum confidence level for notifications
   - Quiet hours
   - Notification channels (in-app, email, etc.)

## Mobile Experience

### Optimized for Mobile

- **List View** is default on mobile devices
- **Swipe gestures** for navigation
- **Pull to refresh** for syncing
- **Drawer filters** for easy access

### Touch Gestures

- **Swipe left/right**: Navigate between time periods
- **Pinch to zoom**: Switch between month and week views
- **Long press**: Quick event actions
- **Pull down**: Refresh calendar data

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `←` / `→` | Previous/Next period |
| `↑` / `↓` | Previous/Next week (week view) |
| `T` | Today |
| `M` | Month view |
| `W` | Week view |
| `L` | List view |
| `A` | Agenda view |
| `F` | Open filters |
| `E` | Export menu |
| `R` | Refresh |
| `?` | Show shortcuts help |

## Tips & Best Practices

### Improving Prediction Accuracy

1. **More History = Better Predictions**: The system needs at least 3-5 chapters to detect patterns
2. **Confirm Releases**: Marking releases as confirmed helps improve future predictions
3. **Report Issues**: Use the feedback button for incorrect predictions

### Managing Multiple Series

1. Use **color coding** by manga for easy identification
2. **Filter by priority**: Focus on your most important series
3. **Export weekly schedule**: Get a weekly digest of upcoming releases

### Handling Special Cases

- **Hiatus**: The system detects extended breaks and adjusts predictions
- **Double Releases**: Special chapters are marked accordingly
- **Holiday Schedules**: Known holidays are factored into predictions

## Troubleshooting

### Calendar Not Updating

1. Check if the manga is set to "monitored"
2. Ensure you have an internet connection
3. Try manual sync with the refresh button
4. Clear browser cache if issues persist

### Missing Predictions

- New manga need 3+ chapters for pattern detection
- Irregular series may show lower confidence
- Check if the manga source is properly configured

### Incorrect Predictions

1. Report via the feedback button on the event
2. Manually adjust the pattern in manga settings
3. The system will learn from corrections

## Advanced Features

### RSS Feed Integration

1. Click **Export** → **RSS Feed**
2. Copy the RSS URL
3. Add to your feed reader
4. Receive updates for new predictions

### Calendar Sync

1. Export as iCal
2. Set up recurring export (Settings → Calendar → Auto-export)
3. Subscribe to the calendar URL in your calendar app
4. Updates sync automatically

### Programmatic Access

Calendar data is served by the `calendar` tRPC router
(`src/server/trpc/routers/calendar.ts`), with an export handler at
`calendar/export-handler.ts`. Call it through the typed tRPC client like any other
router (there is no standalone REST `/api/calendar` endpoint).

## Privacy & Data

- All predictions are generated locally
- No personal calendar data is shared
- Export data remains private
- Notification preferences are stored securely

## Feedback

Help improve predictions:
- Use the 👍/👎 buttons on predictions
- Report pattern changes
- Suggest new features via feedback form

---

For technical documentation and API details, see the Developer Guide.
