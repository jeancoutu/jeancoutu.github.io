# Weekly Meal Planner

A Progressive Web App (PWA) for planning meals for the week. Browse recipes, assign meals to days, auto-fill your week, and see a grocery list for planned meals—backed by Supabase (Postgres + Auth).

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

## Commands reference

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Development server with hot reload |
| `npm run dev -- --host` | Dev server on your LAN (for phone testing) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run check` | Svelte/TypeScript checks |
| `npm run test` | Run tests (single run) |
| `npm run test:watch` | Run tests in watch mode |

---

## Features

- **Meals** — Search and filter by duration (short / medium / long); view full recipes
- **Planner** — Assign meals per day; auto-fill empty days; clear week
- **Grocery list** — Aggregated ingredient list for the current week's plan
- **PWA** — Install on iPhone/Android; works offline after first load

## Stack

- Svelte 5 + TypeScript + Vite
- Tailwind CSS 4
- Supabase (Postgres + Auth + RLS)
- vite-plugin-pwa (offline + installable)

## PWA icons

Icons live in `public/` (`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`). To regenerate on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1
```

Then run `npm run build` again.
