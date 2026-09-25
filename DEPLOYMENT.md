# Vineyard Notebook - Deployment Guide

This guide covers deploying Vineyard Notebook to Firebase Hosting. Hosting is a
static single-page app deployment; Firebase Auth, Firestore, Storage, and
Functions keep their existing behavior.

## Prerequisites

1. A Firebase project with a registered web app.
2. Firebase CLI installed (`npm install -g firebase-tools`) and authenticated
   with `firebase login`.
3. Firebase Hosting enabled for the project. Select the project with
   `firebase use YOUR_FIREBASE_PROJECT_ID` (or pass `--project` to each command).
   This repository already contains the Hosting configuration; do not overwrite
   `firebase.json` with a new initialization.
4. Email/Password Authentication, Firestore, and Storage enabled as described
   below. Enable Functions only if using the live calendar feed.
5. Billing: Hosting, Auth, Firestore, and Storage can be used on the Spark plan
   within its quotas. Deploying or running the calendar Cloud Functions requires
   the Blaze (pay-as-you-go) plan; review quotas and budget alerts before using it.
6. The deployed Hosting domain must be listed in Firebase Console →
   Authentication → Settings → Authorized domains. Add a custom domain there
   too if one is used. `localhost` is needed for local development.

No production deployment or data migration is part of local validation.

## Firebase Setup

### 1. Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add project"
3. Enter project name (e.g., "vineyard-notebook")
4. Disable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click "Get started"
3. Enable **Email/Password** sign-in method
4. Save

### 3. Create Firestore Database

1. Go to **Firestore Database**
2. Click "Create database"
3. Choose "Start in production mode"
4. Select a location (choose closest to your users)
5. Click "Enable"

### 4. Enable Storage

1. Go to **Storage**
2. Click "Get started"
3. Choose "Start in production mode"
4. Use default storage location
5. Click "Done"

### 5. Deploy Security Rules

Install Firebase CLI if you haven't:
```bash
npm install -g firebase-tools
```

Login and initialize:
```bash
firebase login
firebase init
```

Select:
- Firestore
- Storage

When prompted:
- Use existing project
- Select your Firebase project
- Use `firestore.rules` and `storage.rules`
- Don't overwrite existing rules files

Deploy rules:
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

### 6. Get Firebase Configuration

1. In Firebase Console, click the gear icon → **Project settings**
2. Scroll to "Your apps" section
3. Click the **web icon** (</>)
4. Register app with nickname (e.g., "vineyard-web")
5. Copy the config object

## Environment Variables

Vite embeds these values into the browser bundle at build time. Create a local
`.env` or a deployment-only `.env.production` (both are ignored by Git); never
put secrets or a real production configuration in the repository:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

All six `VITE_FIREBASE_*` variables are required for a configured build. They
identify the Firebase web app; access is still enforced by Firebase Auth and
security rules.

## Firebase Hosting

Run the build locally before deploying so the `dist/` output and manifest can
be checked without contacting Firebase:

```bash
npm ci
npm run lint
npm test
npm run build
npm run preview # optional local production preview
```

Deploy only Hosting after selecting the intended Firebase project:

```bash
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
firebase deploy --only hosting
# Or avoid changing local project selection:
firebase deploy --only hosting --project YOUR_FIREBASE_PROJECT_ID
```

`firebase.json` publishes `dist/`, ignores dotfiles and dependencies, and
rewrites unknown paths to `index.html` for React Router. Vite fingerprints
bundled assets under `dist/assets/`; Firebase serves those immutable assets
for one year. `index.html` and `sw.js` are explicitly no-cache so a new shell
and service-worker version can be discovered after release.

### App-shell caching and limitations

The production service worker caches only the static app shell, install icons,
and hashed Vite assets. It uses the network first for navigations and falls
back to the cached shell only when offline. It does **not** cache Firebase
Auth, Firestore, Storage, Functions, or other API responses, and it does not
make the authenticated app usable on a first visit without network access.
Firestore's existing SDK persistence remains responsible for its own offline
behavior; this PWA layer does not change that configuration.

After a release, normal navigation discovers the no-cache `sw.js`. If a client
is stuck on an old shell, close all app tabs and reload; as a last resort clear
this site's service-worker/cache data in browser settings. Do not add broad
cache rules to the service worker because authenticated or API data must not be
retained there.

### Rollback

If a Hosting release is faulty, use Firebase Console → Hosting → Release
history → the known-good release → **Rollback**, then verify the site and Auth
sign-in. The Firebase CLI does not expose a general live-release rollback
command; use a deliberate new deployment of the known-good commit if the
console rollback is unavailable.

Because `index.html` and the worker are no-cache, rollback is normally visible
on the next navigation. Existing hashed assets are retained by Hosting; do not
manually delete them while investigating.

## Deploy to Vercel

### Method 1: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Follow prompts:
# - Link to existing project or create new
# - Set up environment variables when prompted
```

### Method 2: Vercel Dashboard

1. Go to https://vercel.com
2. Click "New Project"
3. Import your Git repository
4. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add environment variables (from your `.env` file)
6. Click "Deploy"

## Deploy to Netlify

### Method 1: Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize
netlify init

# Deploy
netlify deploy --prod
```

### Method 2: Netlify Dashboard

1. Go to https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Connect to your Git provider
4. Select your repository
5. Configure:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Add environment variables:
   - Go to Site settings → Environment variables
   - Add all `VITE_FIREBASE_*` variables
7. Click "Deploy site"

## Post-Deployment

### 1. Update Firebase Auth Domain

1. In Firebase Console, go to **Authentication** → **Settings** → **Authorized domains**
2. Add your production domain (e.g., `your-app.vercel.app` or `your-app.netlify.app`)

### 2. Test the Deployment

1. Visit your deployed URL
2. Create an account
3. Create a project
4. Verify data syncs to Firestore (check Firebase Console)
5. Test photo upload to Storage

### 3. Set Up Custom Domain (Optional)

#### Vercel
1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

#### Netlify
1. Go to Site settings → Domain management
2. Add custom domain
3. Follow DNS configuration instructions

## Continuous Deployment

Both Vercel and Netlify automatically deploy when you push to your main branch:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

The deployment will start automatically.

## Monitoring

### Firebase Console

- **Authentication**: Monitor user signups
- **Firestore**: Check database usage and queries
- **Storage**: Monitor file uploads and storage usage

### Vercel/Netlify Dashboards

- View deployment logs
- Monitor build times
- Check analytics (if enabled)

## Troubleshooting

### Build Fails

1. Check build logs for errors
2. Verify all environment variables are set
3. Test build locally: `npm run build`

### Firebase Connection Issues

1. Verify environment variables are correct
2. Check Firebase Auth authorized domains
3. Review browser console for errors
4. Verify security rules are deployed

### Photo Upload Issues

1. Check Storage security rules
2. Verify Storage is enabled in Firebase
3. Check file size limits (current: 10MB)

## Security Checklist

- ✅ Firestore security rules deployed
- ✅ Storage security rules deployed
- ✅ Environment variables not committed to Git
- ✅ Firebase Auth domain restricted to your production URL
- ✅ HTTPS enforced (Vercel/Netlify do this automatically)

## Scaling Considerations

For production use with multiple vineyards:

1. **Firestore indexes**: Create composite indexes as needed
2. **Storage quotas**: Monitor usage in Firebase Console
3. **Security rules**: Review and optimize for performance
4. **Backup**: Set up automated Firestore backups

## Cost Estimates

Firebase Free Tier (Spark Plan):
- Auth: 50K verifications/month
- Firestore: 1GB storage, 50K reads/day
- Storage: 5GB storage, 1GB/day downloads

Should be sufficient for small vineyards (2-10 projects).

Vercel/Netlify Free Tier:
- Vercel: 100GB bandwidth/month
- Netlify: 100GB bandwidth/month, 300 build minutes/month

Both are generous for personal/small team use.

## Support

For issues, check:
1. Firebase Console for errors
2. Browser developer console
3. Deployment platform logs (Vercel/Netlify)
4. This project's GitHub issues (if applicable)
