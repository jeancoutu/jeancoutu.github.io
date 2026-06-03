# Weekly Meal Planner

A Progressive Web App (PWA) for planning meals for the week. Browse recipes, assign meals to days, auto-fill your week, and see ingredients for planned meals—all stored locally in your browser (no account or server required).

## Prerequisites

- **Node.js** 20.19+ or 22.12+ ([nodejs.org](https://nodejs.org/))
- **npm** (included with Node.js)

Check your versions:

```bash
node -v
npm -v
```

## Quick start (local development)

1. **Clone or open the project** and go to the folder:

   ```bash
   cd c:\projects\mealplan
   ```

2. **Install dependencies** (first time only):

   ```bash
   npm install
   ```

3. **Start the dev server**:

   ```bash
   npm run dev
   ```

4. Open the URL shown in the terminal (usually **http://localhost:5173**) in your browser.

The dev server reloads automatically when you change code.

### Optional: type checking

```bash
npm run check
```

---

## Build and run a production build locally

1. **Create an optimized production bundle**:

   ```bash
   npm run build
   ```

   Output goes to the `dist/` folder (minified JS/CSS, service worker, PWA manifest, icons).

2. **Preview the production build** on your computer:

   ```bash
   npm run preview
   ```

   Open **http://localhost:4173** (or the URL Vite prints). This is what users get after you deploy `dist/`.

---

## Making it production ready

The app is already set up as a static PWA. Before you share it or use it daily on your phone, do the following.

### 1. Verify the production build

```bash
npm run build
npm run preview
```

Confirm in the browser:

- Planner and Meals tabs work
- Meal search, filters, and recipe details work
- Weekly plan survives a **page refresh**
- **Auto Fill Week** and **Clear Week** work
- Ingredient summary updates when you change the plan

### 2. Deploy to HTTPS (required for iPhone install)

PWAs on iPhone need a **secure context** (HTTPS). `localhost` is only for your computer—not for installing on your phone over the network.

Pick one host and deploy the contents of `dist/`:

| Host | Typical flow |
|------|----------------|
| **Vercel** | Connect repo → build command `npm run build` → output `dist` |
| **Netlify** | Same; `public/_redirects` is included for SPA routing |
| **Cloudflare Pages** | Build `npm run build`, publish `dist` |
| **GitHub Pages** | See [GitHub Pages](#github-pages) below |

After deploy, open your site URL in **Safari** on iPhone (not Chrome-only features—Safari is required for “Add to Home Screen” on iOS).

### 3. GitHub Pages

This repo includes [`.github/workflows/deploy.yml`](/github/workflows/deploy.yml), which builds the Vite app and publishes `dist/` on every push to `master`.

**One-time setup**

1. Open the repo on GitHub -> **Settings** -> **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (not "Deploy from a branch")
3. Push to `master` (or run the workflow manually under **Actions**)

**User site** (`jeancoutu.github.io`): no extra config - assets are served from `/`.

**Project site** (`https://<user>.github.io/<repo>/`): set the base path when building:
```
VITE_BASE_PATH=/your-repo-name/ npm run build
```

In CI, add that variable to the build step in the workflow.
Routing and asset URLs pick up the base automatically.

### 4. Production checklist

- [ ] `npm run build` completes with no errors
- [ ] `npm run check` passes (optional but recommended)
- [ ] Site is served over **HTTPS**
- [ ] All routes work after refresh (e.g. `/planner`, `/meals`, `/meal/spaghetti`)
- [ ] PWA manifest and icons load (check DevTools → Application → Manifest)
- [ ] Service worker registers (Application → Service Workers)
- [ ] You tested install + offline on a real iPhone (see below)

### 5. What you do *not* need

- No database, API, or environment secrets for core features
- No App Store build—this is a web app installed from Safari

Data is stored only in the browser (`localStorage`, key `weekly-plan`).

---

## Using the app on your iPhone

You install it like an app from Safari—no App Store.

### Recommended: install from your deployed HTTPS URL

1. Deploy the app (see [Making it production ready](#making-it-production-ready)) and note your URL, e.g. `https://your-app.vercel.app`.
2. On your iPhone, open **Safari** and go to that URL.
3. Use the app once so the service worker can cache assets (stay online for the first visit).
4. Tap the **Share** button (square with arrow).
5. Tap **Add to Home Screen**.
6. Confirm the name (e.g. “Meals”) and tap **Add**.

Open the icon from your home screen. It runs full-screen (`standalone`) like a native app and works **offline** after the first successful load.

### Test on iPhone before deploying (same Wi‑Fi)

Useful for UI testing; **full PWA install may not work** without HTTPS.

1. On your PC, start the dev server reachable on your network:

   ```bash
   npm run dev -- --host
   ```

2. Find your PC’s local IP (Windows: `ipconfig`, look for IPv4, e.g. `192.168.1.42`).

3. On iPhone Safari, open `http://192.168.1.42:5173` (use your IP and port).

4. Allow through Windows Firewall if prompted.

For **Add to Home Screen** and offline on iPhone, prefer a deployed HTTPS URL or a tunnel:

```bash
# Example: expose local preview with HTTPS via ngrok (install ngrok separately)
npm run build
npm run preview -- --host
# In another terminal: ngrok http 4173
```

Open the `https://….ngrok.io` URL in Safari, then **Add to Home Screen**.

### Tips on iPhone

- Use **Safari** for install; other browsers on iOS may not offer Add to Home Screen the same way.
- If the icon opens in a browser tab instead of standalone, remove the old home screen icon and add again from Safari after a fresh visit.
- Plan data stays on **that device** in Safari’s storage; clearing website data removes your weekly plan.

---

## Commands reference

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Development server with hot reload |
| `npm run dev -- --host` | Dev server on your LAN (for phone testing) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run preview -- --host` | Preview on your LAN |
| `npm run check` | Svelte/TypeScript checks |

---

## Features

- **Meals** — Search and filter by duration (short / medium / long); view full recipes
- **Planner** — Assign meals per day; auto-fill empty days; clear week
- **Ingredients** — Grouped by meal for the current week (no merged grocery list)
- **PWA** — Install on iPhone/Android; works offline after first load

## Stack

- Svelte 5 + TypeScript + Vite
- Tailwind CSS
- vite-plugin-pwa (offline + installable)

## PWA icons

Icons live in `public/` (`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`). To regenerate on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1
```

Then run `npm run build` again.
