# Testing the CORS Fix

## What was fixed

Fixed CORS configuration on Firebase Cloud Functions to allow the calendar subscription feature to work from localhost during development.

## Changes Made

1. **Added CORS package**: Added `cors` npm package and `@types/cors` to functions/package.json
2. **Updated calendarFeed function**: Wrapped the onRequest handler with CORS middleware that allows all origins
3. **Added Functions SDK to client**: Added Firebase Functions SDK initialization to src/lib/firebase.ts
4. **Configured emulator**: Added Functions emulator connection for local development

## How to Test

### 1. Deploy Functions to Firebase (Production Test)

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

After deployment, the functions will be available at:
- `https://us-central1-{project-id}.cloudfunctions.net/calendarFeed`
- `https://us-central1-{project-id}.cloudfunctions.net/generateCalendarToken`
- `https://us-central1-{project-id}.cloudfunctions.net/revokeCalendarToken`
- `https://us-central1-{project-id}.cloudfunctions.net/listCalendarTokens`

### 2. Test Locally with Emulators (Development Test)

```bash
# Terminal 1: Start Firebase Emulators
cd functions
npm run serve

# Terminal 2: Start the app with emulator flag
export VITE_USE_FIREBASE_EMULATOR=true
npm run dev
```

### 3. Test the Calendar Subscription Modal

1. Start the app (`npm run dev`)
2. Navigate to the Calendar tab
3. Click the "Subscribe to Calendar" button (should be visible after the app updates)
4. Click "Generate Subscription Link"
5. Verify that:
   - No CORS errors appear in the browser console
   - A token is generated successfully
   - The subscription URL is displayed
   - You can copy the URL
   - The token appears in the "Active Tokens" list

### 4. Verify CORS Headers

You can verify the CORS headers are properly set by:

**For calendarFeed (public endpoint):**
```bash
curl -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -i \
  https://us-central1-{project-id}.cloudfunctions.net/calendarFeed
```

Expected response should include:
```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Credentials: true
```

**For callable functions:**
The Firebase SDK automatically handles CORS for `onCall` functions. You should test these through the app's UI using the Firebase Functions SDK's `httpsCallable`.

## Expected Behavior

### Before the fix:
- Browser console shows: `Access-Control-Allow-Origin header is not present on the requested resource`
- Calendar subscription modal fails to load existing tokens
- Cannot generate new tokens

### After the fix:
- No CORS errors in browser console
- Calendar subscription modal successfully loads existing tokens
- Can generate and revoke tokens without errors
- Calendar feed endpoint accepts requests from any origin (for calendar client compatibility)

## Technical Details

### CORS Configuration

The `cors` package is configured with:
```typescript
const corsHandler = cors({
  origin: true, // Allows all origins (necessary for calendar clients)
  credentials: true,
});
```

- `origin: true` - Reflects the request origin (allows all origins)
- `credentials: true` - Allows credentials (cookies, auth headers)

This configuration is necessary because:
1. Calendar clients (Google Calendar, Apple Calendar, etc.) make requests from various origins
2. The app needs to work from both localhost (dev) and production domains
3. Firebase callable functions handle CORS automatically, but we ensure consistency

### Functions Architecture

1. **calendarFeed**: HTTP endpoint (onRequest) - uses CORS middleware
2. **generateCalendarToken**: Callable function (onCall) - CORS handled by Firebase
3. **revokeCalendarToken**: Callable function (onCall) - CORS handled by Firebase
4. **listCalendarTokens**: Callable function (onCall) - CORS handled by Firebase

## Troubleshooting

If you still see CORS errors:

1. **Check Functions are deployed**: Run `firebase functions:list` to see deployed functions
2. **Clear browser cache**: Hard refresh with Ctrl+Shift+R (or Cmd+Shift+R on Mac)
3. **Check emulator configuration**: Ensure `VITE_USE_FIREBASE_EMULATOR` is set correctly
4. **Verify Firebase project**: Make sure you're connected to the correct Firebase project
5. **Check Firebase SDK version**: Ensure you have compatible versions of firebase packages
6. **Review browser console**: Look for specific CORS error messages that might indicate other issues

## Documentation Updates Needed

After testing, consider updating:
- `AGENTS.md` - Add note about CORS configuration for Cloud Functions
- `CALENDAR-SUBSCRIPTION.md` - Add deployment instructions
