# Calendar Export Implementation

## Overview
This document describes the calendar export feature that allows users to download their vineyard calendar events as a standard .ics (iCalendar) file.

## What Was Implemented

### 1. New Dependencies
- **ics** (v3.12.0): Standard iCalendar format library for generating RFC 5545 compliant .ics files

### 2. New Files
- `src/lib/calendar-export.ts`: Core export utilities
  - `generateICS()`: Converts calendar events to .ics format
  - `downloadICS()`: Triggers browser download of .ics file
  - `dateToArray()`: Helper to convert ISO dates to ics DateArray format

### 3. Modified Files
- `src/features/calendar/CalendarView.tsx`:
  - Replaced placeholder export button with functional implementation
  - Added event count display
  - Disabled button when no events exist
  - Integrated with calendar-export utilities

## Features

### Export Button
- Located at the bottom of the Calendar view
- Shows event count: "Export to calendar (.ics) (X events)"
- Disabled when no events exist
- Styled to match the app's wine-themed design

### Generated .ics File
- **Filename**: `vineyard-calendar-{season}.ics` (e.g., `vineyard-calendar-2024.ics`)
- **Format**: Standard iCalendar (RFC 5545) format
- **Compatibility**: Works with Google Calendar, Outlook, Apple Calendar, etc.

### Events Included
1. **Phase Start/End Dates**:
   - Title: "{Phase Name} (Start)" or "{Phase Name} (End)"
   - Description: "Start/End of {Phase Name} phase"
   
2. **Sub-Events (Checks)**:
   - Title: "{Phase Name}: {Check Name}"
   - Description: "{Check Name} for {Phase Name}"

### Event Properties
- All events are formatted as **all-day events**
- Each event has a unique UID for proper calendar synchronization
- Product ID: "vineyard-notebook"
- Start date in local time format

## Technical Details

### Date Conversion
ISO date strings (YYYY-MM-DD) are converted to ics DateArray format [year, month, day]:
```typescript
"2024-09-15" → [2024, 9, 15]
```

### Error Handling
- Returns null if no events to export
- Shows alert to user if generation fails
- Console logs errors for debugging

### Browser Download
- Creates a Blob with MIME type `text/calendar;charset=utf-8`
- Uses URL.createObjectURL() for download
- Properly cleans up object URLs after download

## Testing
- TypeScript compilation: ✅ Passes
- Production build: ✅ Succeeds
- Manual test of ics library: ✅ Generates valid .ics format

## Usage
1. Navigate to Calendar view
2. Click "Export to calendar (.ics)" button
3. Browser downloads the .ics file
4. Import the file into any calendar application

## Future Enhancements (Optional)
- Filter options (e.g., next 30 days, current month, date range)
- Include inventory shortage alerts in export
- Custom event colors in supporting calendar apps
- Recurring event support for regular checks
