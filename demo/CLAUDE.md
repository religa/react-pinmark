# react-pinmark — demo app

Standalone Vite + React demo for the `react-pinmark` library. No build step required — `react-pinmark` is aliased directly to `../src/index.ts`.

## Commands

```bash
npm install   # first time only
npm run dev   # dev server at localhost:5173
npm run build # production build into dist/
```

## How it works

- `vite.config.ts` aliases `react-pinmark` → `../src/index.ts` and `react-pinmark/supabase` → `../src/adapters/supabase/index.ts`, so library source changes are reflected immediately via HMR
- `src/App.tsx` auto-detects Supabase env vars at startup — uses the real Supabase backend if `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, otherwise falls back to the localStorage mock
- `src/mock-backend.ts` implements `BackendAdapter` using `localStorage` — comments persist under the key `rc_demo_threads`; clear it in DevTools to reset
- `src/demo.css` contains all page styles, prefixed `demo-*` to avoid collisions with the library's `rc-*` classes
- The library's `base.css` is imported automatically when `CommentOverlay` renders

## Structure

```
demo/
├── .env.local.example    # copy to .env.local and fill in Supabase credentials
├── index.html            # loads Google Fonts (Instrument Serif, Geist, Geist Mono)
├── vite.config.ts        # react-pinmark + react-pinmark/supabase aliases (specific first)
├── tsconfig.json         # standalone config with paths aliases for both entries
└── src/
    ├── vite-env.d.ts     # /// <reference types="vite/client" /> for import.meta.env
    ├── main.tsx          # ReactDOM.createRoot entry
    ├── App.tsx           # demo UI + backend selection logic
    ├── mock-backend.ts   # localStorage-backed BackendAdapter
    └── demo.css          # page styles (light + dark mode via CSS vars)
```

## UI controls

| Control | What it does |
|---|---|
| ◑ / ☀ / ☾ button | Cycles `colorScheme` prop on `CommentProvider` (system → light → dark) |
| Show resolved toggle | Flips `hideResolved` prop on `CommentOverlay` |
| Press `C` | Toggle comment mode — cursor becomes crosshair |
| Click (in comment mode) | Place a pin and open the composer |
| Click a pin | Open the thread popover |
| List button (bottom-right) | Open the thread list panel |

## Connecting Supabase

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) → New project. Wait for it to provision (~1 min).

### 2. Run the three migrations

In the Supabase dashboard → **SQL Editor**, paste and run each file in order:

1. `../src/adapters/supabase/migrations/001_create_threads.sql`
2. `../src/adapters/supabase/migrations/002_create_comments.sql`
3. `../src/adapters/supabase/migrations/003_create_storage.sql`

Verify under **Table Editor** — `rc_threads` and `rc_comments` should appear.

### 3. Get your credentials

**Project Settings → API:**
- **Project URL** — `https://xxxxxxxxxxxx.supabase.co`
- **anon public key** — the long `eyJ...` string

### 4. Create `.env.local`

```bash
cp .env.local.example .env.local
# then fill in the two values
```

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Restart the dev server (`npm run dev`) — it will now use Supabase automatically. Image uploads are also enabled (the Supabase adapter doubles as an `AttachmentAdapter`).
