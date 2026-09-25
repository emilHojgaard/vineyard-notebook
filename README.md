# Vineyard Notebook

A collaborative winemaking management app for small vineyards. Track your vineyard's timeline from growing season through bottling, manage inventory, maintain a reference library, and coordinate with your team.

## Features

- **Timeline**: Track the season's phases (Growing Season, Harvest, Fermentation, etc.) with dates, notes, photos, and sub-events
- **Tree View**: Visualize the season's structure and branch points (e.g., Red vs White wine from same harvest)
- **Calendar**: Month view with all phases and sub-events
- **Inventory**: Equipment and supplies tracking with shortage alerts
- **Library**: Reference notes, PDFs, videos, and photos tagged to phases
- **Multi-vintage**: Switch between current season and past vintages
- **Collaborative**: Multiple team members with real-time sync
- **Offline-first**: Works without internet, syncs when connected

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Auth + Firestore + Storage)
- **Hosting**: Firebase Hosting (static SPA)

## Project Structure

```
src/
  components/       # Reusable UI components
  features/         # Feature modules (timeline, inventory, etc.)
    timeline/
    tree/
    calendar/
    inventory/
    library/
  lib/              # Utilities and helpers
  hooks/            # Custom React hooks
  contexts/         # React contexts (auth, data)
  types/            # TypeScript type definitions
  App.tsx
  main.tsx
```

## Design Source

This app is built from the interactive mockup in `design/vineyard-notebook.html`. See `design/BUILD-NOTES.md` for the complete data model and implementation notes.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Firebase:**
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Authentication (Email/Password)
   - Create a Firestore database
   - Enable Storage
   - Copy `.env.example` to `.env` and fill in your Firebase config

3. **Run development server:**
   ```bash
   npm run dev
   ```

## Environment Variables

Create a `.env` file with your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Deployment

Firebase Hosting serves the production build from `dist/` and provides the SPA
fallback configured in `firebase.json`. See [DEPLOYMENT.md](DEPLOYMENT.md) for
Firebase project prerequisites, environment variables, cache behavior, and
rollback guidance.

```bash
npm ci
npm run build
firebase deploy --only hosting --project YOUR_FIREBASE_PROJECT_ID
```

## License

Private project for personal use.
