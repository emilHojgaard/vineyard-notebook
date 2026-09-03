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
- **Hosting**: Vercel/Netlify (free tier)

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

## Development

```bash
npm install
npm run dev
```

## Deployment

Free hosting on Vercel/Netlify - deploy directly from GitHub.

## License

Private project for personal use.
