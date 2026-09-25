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

## Firebase Cloud Functions

The live calendar feed is deployed separately from Hosting. Functions run on
Node.js 22, selected because the installed Firebase CLI supports `nodejs22` as
a GA runtime. The same CLI reports Node.js 18 as deprecated, so do not restore
that engine value.

The runtime decision was verified locally with the repository's installed
Firebase CLI (`npx firebase --version` → `15.30.2`) and its deployment runtime
registry (`nodejs22: GA`; `nodejs20: GA`; `nodejs18: deprecated`). The source of
that installed evidence is
`node_modules/firebase-tools/lib/deploy/functions/runtimes/supported/types.js`.
`functions/package.json` and its lockfile are the runtime source of truth.

Build and deploy Functions after selecting the intended Firebase project:

```bash
npm --prefix functions ci
npm --prefix functions run build
firebase deploy --only functions --project YOUR_FIREBASE_PROJECT_ID
```

For local callable/feed validation, use the project-scoped emulator scripts:

```bash
npm run test:functions
npm --prefix functions run serve
```

The Functions emulator and callable tests use the same `functions/package.json`
engine metadata; no production deployment is part of local validation.

## Post-Deployment

### 1. Update Firebase Auth Domain

1. In Firebase Console, go to **Authentication** → **Settings** → **Authorized domains**
2. Add your Firebase Hosting domain (for example, `your-project.web.app` or `your-project.firebaseapp.com`)

### 2. Test the Deployment

1. Visit your deployed URL
2. Create an account
3. Create a project
4. Verify data syncs to Firestore (check Firebase Console)
5. Test photo upload to Storage

### 3. Set Up Custom Domain (Optional)

1. In Firebase Console, open **Hosting** → **Add custom domain**.
2. Follow the displayed DNS verification instructions.
3. Add the verified domain to Firebase Authentication's authorized domains.

## Continuous Deployment

Firebase Hosting deployments are intentionally explicit so the selected
Firebase project is always clear:

```bash
npm ci
npm run build
firebase deploy --only hosting --project YOUR_FIREBASE_PROJECT_ID
```

A CI or release job may run the same command after authenticating with a
service account, but local validation never deploys.

## Monitoring

### Firebase Console

- **Authentication**: Monitor user signups
- **Firestore**: Check database usage and queries
- **Storage**: Monitor file uploads and storage usage

### Firebase Hosting and Functions

- View Hosting releases and logs in Firebase Console → Hosting
- View function logs with `firebase functions:log`
- Monitor Auth, Firestore, Storage, and Functions usage in Firebase Console

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
- ✅ HTTPS enforced by Firebase Hosting

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

Firebase Hosting and the Firebase services have plan-specific quotas; review
current pricing, quotas, and budget alerts before enabling Cloud Functions.

## Support

For issues, check:
1. Firebase Console for errors
2. Browser developer console
3. Firebase Console Hosting and Functions logs
4. This project's GitHub issues (if applicable)
