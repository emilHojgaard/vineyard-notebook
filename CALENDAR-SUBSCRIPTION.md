# Calendar Subscription Feature

## Overview

The Vineyard Notebook now supports live calendar subscriptions. Users can subscribe to their vineyard calendar in Google Calendar, Outlook, Apple Calendar, or any calendar app that supports .ics subscriptions. Events automatically sync when changes are made in the app.

## Architecture

### Firebase Cloud Functions

Three cloud functions handle calendar subscriptions:

1. **`calendarFeed`** (HTTP endpoint)
   - URL: `/calendarFeed/:projectId/:seasonYear?token=xxx`
   - Returns: Dynamically generated .ics file
   - Authentication: Token-based (query parameter)
   - Called by calendar apps to fetch events

2. **`generateCalendarToken`** (Callable function)
   - Generates a unique token for the user and project
   - Stores token in Firestore `calendar_tokens` collection
   - Returns token ID to the client

3. **`revokeCalendarToken`** (Callable function)
   - Deletes a token from Firestore
   - Prevents further access using that token

4. **`listCalendarTokens`** (Callable function)
   - Lists all active tokens for a user and project
   - Used to display existing subscriptions

### Token-Based Authentication

Calendar apps cannot perform interactive authentication (OAuth, cookies, etc.), so we use token-based auth:

- Each token is a unique Firestore document ID
- Token is included in the subscription URL as a query parameter
- Tokens are scoped to a specific user and project
- Tokens are validated on every feed request
- Users can revoke tokens at any time

### Security

- Tokens are stored in Firestore: `calendar_tokens/{tokenId}`
  - `userId`: Owner of the token
  - `projectId`: Project the token grants access to
  - `createdAt`: Timestamp of creation

- Firestore security rules ensure:
  - Users can only read/create/delete their own tokens
  - Token validation happens server-side (Cloud Function)

- On each feed request:
  1. Validate token exists and matches project
  2. Verify user is still a project member
  3. Return 403 if either check fails

### ICS Generation

The `ics-generator.ts` utility:
- Walks the season's node tree recursively
- Extracts phase start/end dates
- Extracts sub-events (checks)
- Generates standard iCalendar format (.ics)
- Includes proper metadata (calendar name, description, timezone)

## Implementation Files

### Backend (Cloud Functions)
- `functions/src/index.ts` - Main functions (feed, token management)
- `functions/src/ics-generator.ts` - ICS file generation
- `functions/package.json` - Dependencies
- `functions/tsconfig.json` - TypeScript config

### Frontend
- `src/features/calendar/CalendarSubscriptionModal.tsx` - Subscription UI
- `src/features/calendar/CalendarView.tsx` - Updated with subscription button
- `src/contexts/DataContext.tsx` - Token management methods
- `src/lib/firebase.ts` - Added Firebase Functions SDK
- `src/components/Icon.tsx` - Added link/copy/close icons

### Configuration
- `firebase.json` - Firebase project configuration
- `firestore.rules` - Updated with calendar_tokens rules

## Deployment

### 1. Install Firebase CLI (if not already installed)
```bash
npm install -g firebase-tools
```

### 2. Install Function Dependencies
```bash
cd functions
npm install
cd ..
```

### 3. Deploy Functions and Rules
```bash
firebase deploy --only functions
firebase deploy --only firestore:rules
```

### 4. Update Function URL in Code

After deploying, update the function URL in `CalendarSubscriptionModal.tsx`:

```typescript
const getFunctionUrl = () => {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  // Update this to match your deployed function region if different
  return `https://us-central1-${projectId}.cloudfunctions.net/calendarFeed`;
};
```

## Usage

### For Users

1. Navigate to the Calendar tab
2. Click "Subscribe to Calendar"
3. Click "Generate Subscription Link"
4. Copy the generated URL
5. Follow platform-specific instructions:
   - **Google Calendar**: Add calendar → From URL → Paste
   - **Apple Calendar**: File → New Calendar Subscription → Paste
   - **Outlook**: Add calendar → Subscribe from web → Paste

### Token Management

- Users can view all active tokens in the subscription modal
- Tokens show creation date
- Click "Revoke" to invalidate a token
- Revoking a token immediately stops calendar syncing
- Generate new tokens as needed

## Technical Details

### Refresh Behavior

Calendar apps refresh subscribed calendars at different intervals:
- **Google Calendar**: Every 24 hours (cannot be changed)
- **Apple Calendar**: Every 1-24 hours (configurable in settings)
- **Outlook**: Every 3 hours by default

Users can force refresh in most calendar apps, but automatic sync may take hours.

### Event Format

Each event in the .ics file includes:
- **UID**: Unique identifier (nodeId-start, nodeId-end, or eventId)
- **SUMMARY**: Event title (e.g., "Pruning - Start" or "Harvest - Brix Check")
- **DTSTART**: Start date (DATE format, not datetime)
- **DESCRIPTION**: Phase/check details
- **DTSTAMP**: Timestamp of generation

### Limitations

- All-day events only (no times)
- No recurring events
- Calendar apps may cache data (delayed sync)
- Token must be kept private (anyone with the URL can view events)

## Future Enhancements

Potential improvements:
- Token expiration (currently tokens are long-lived)
- Token usage analytics (last accessed timestamp)
- Multiple season subscriptions in one feed
- Webhook-based updates (push instead of pull)
- OAuth-based authentication for calendar apps that support it
- Event reminders/alarms in .ics file

## Troubleshooting

### "Invalid or expired token" error
- Token may have been revoked - generate a new one
- User may have been removed from the project

### Events not appearing
- Calendar apps can take hours to refresh
- Try force-refreshing the calendar
- Verify the subscription is active in calendar settings
- Check that events exist in the Vineyard Notebook app

### "Failed to generate token" error
- Ensure Firebase Functions are deployed
- Check Firebase Console for function errors
- Verify user is authenticated and a project member

## Cost Considerations

Firebase Functions pricing:
- Free tier: 2M invocations/month
- Each calendar refresh = 1 invocation
- With 10 users refreshing daily: ~300 invocations/month (well within free tier)
- Functions are lightweight (fast execution, minimal compute)

Firestore:
- Calendar tokens stored in Firestore
- Minimal storage cost (one document per token)
- Token validation reads: 1 read per calendar refresh

Expected cost for small vineyard teams: **$0/month** (within free tier)
