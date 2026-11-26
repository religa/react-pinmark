# react-pinmark

[![npm](https://img.shields.io/npm/v/react-pinmark.svg)](https://www.npmjs.com/package/react-pinmark)
[![CI](https://github.com/religa/react-pinmark/actions/workflows/ci.yml/badge.svg)](https://github.com/religa/react-pinmark/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![bundlephobia](https://img.shields.io/bundlephobia/minzip/react-pinmark)](https://bundlephobia.com/package/react-pinmark)

Embeddable pin-based commenting overlay for React applications. Drop it into any React app — users click to pin comments anywhere on the page, no separate tool, no context switching.

- **~7.6 KB** gzipped core (`html-to-image` is lazy-loaded only when screenshot capture is used)
- Portal-based — never conflicts with your layout or z-index stacking
- Supabase adapter included; plug in any backend with a 5-method interface
- Dark mode, Markdown rendering, image attachments, auto viewport screenshot

## Try the demo

```bash
npm install              # root deps (first time only)
cd demo && npm install   # demo deps (first time only)
cd ..
npm run demo             # starts at http://localhost:5173
```

The demo app requires no build step — library source changes are reflected immediately via HMR. Comments persist in `localStorage` under `rc_demo_threads`; clear it in DevTools to reset.

To use Supabase in the demo, copy `demo/.env.local.example` to `demo/.env.local` and fill in your project URL and anon key.

## Install

```bash
npm install react-pinmark
```

React 18+ is required as a peer dependency.

## Quick start

```tsx
import { CommentProvider, CommentOverlay } from 'react-pinmark';
import 'react-pinmark/styles';

export default function App() {
  return (
    <CommentProvider backend={myBackend} projectId="my-app">
      <YourApp />
      <CommentOverlay />
    </CommentProvider>
  );
}
```

The CSS file must be imported once — it contains all overlay styles.

## Features

- **Pin-based comments** — press `C` to enter comment mode, click anywhere to drop a pin
- **Threaded replies** — full threads with author names and relative timestamps
- **Image attachments** — upload images via button or paste from clipboard
- **Auto screenshot** — optionally capture a viewport screenshot on pin placement and attach it to the thread
- **Thread list** — slide-in panel to browse and filter all threads across pages
- **Dark mode** — `light`, `dark`, or `system` (follows OS preference)
- **Markdown rendering** — bold, italic, code, links in comment bodies
- **Accessible** — ARIA labels, keyboard navigation, Esc to close

## API Reference

### `<CommentProvider>`

Wraps your app and provides the comment context. Must be an ancestor of `<CommentOverlay>`.

| Prop | Type | Default | Description |
|---|---|---|---|
| `backend` | `BackendAdapter` | required | Storage adapter for threads and comments. |
| `projectId` | `string` | required | Namespaces threads to a project/app. |
| `author` | `{ displayName: string; id?: string }` | — | Override identity. Skips the first-time name prompt. Pass a stable `id` (e.g. your user id) to enable "Waiting for you". |
| `colorScheme` | `'light' \| 'dark' \| 'system'` | `'system'` | Theme. `'system'` follows `prefers-color-scheme`. |
| `attachmentAdapter` | `AttachmentAdapter` | — | Enables image upload in the composer (button + paste). |
| `captureScreenshot` | `boolean` | `false` | Auto-capture a viewport screenshot when a pin is placed. Requires `attachmentAdapter`. |
| `contextProvider` | `() => Record<string, unknown>` | — | Returns custom metadata attached to each new thread. |
| `enabled` | `boolean` | `true` | Mount or unmount the overlay entirely. |

#### Context & metadata

Every new thread automatically captures environment context (viewport, screen size, device pixel ratio, full URL, page language, color scheme, user agent, and page title) into the thread's `metadata` field. This makes comments interpretable even after the page has changed.

For app-specific context, use `contextProvider` to attach data that only the host app knows:

```tsx
<CommentProvider
  backend={adapter}
  projectId="my-app"
  contextProvider={() => ({
    userId: currentUser.id,
    userRole: currentUser.role,
    featureFlags: getActiveFlags(),
    route: router.currentRoute.name,
    filters: searchParams.toString(),
  })}
>
```

**Recommended fields**: authenticated user ID/role, active feature flags or A/B variants, route name or parameters, active filters/search state, and any app state that affects what the user sees on screen.

### `<CommentOverlay>`

Renders the portal with floating controls, pins, thread popover, and thread list.

| Prop | Type | Default | Description |
|---|---|---|---|
| `hideResolved` | `boolean` | `true` | Show only active threads (`open` + `pending`) in the overlay; hide `resolved` and `dismissed`. |
| `zIndex` | `number` | `10000` | CSS `z-index` for the overlay root. |
| `shortcutKey` | `string \| null` | `'c'` | Key that toggles comment mode. Pass `null` to disable. |
| `onNavigatePage` | `(pageUrl: string) => void` | — | Called when the user clicks a thread on another page. Use your router's navigate function; falls back to `window.location.href`. |

### `useComments()`

Access the full comment state and actions from any component inside `<CommentProvider>`.

```ts
const {
  threads,           // Thread[]
  isCommentMode,     // boolean
  activeThread,      // Thread | null
  isThreadListOpen,  // boolean
  filter,            // ThreadFilter
  isLoading,         // boolean

  toggleCommentMode,
  openThread,
  closeThread,
  openThreadList,
  closeThreadList,
  createThread,
  replyToThread,
  setThreadStatus,   // (threadId, 'open' | 'pending' | 'resolved' | 'dismissed')
  deleteThread,
  deleteComment,
  refreshThreads,
  setFilter,
} = useComments();
```

## Keyboard shortcuts

| Key | Action |
|---|---|
| `C` | Toggle comment mode (configurable via `shortcutKey` on `<CommentOverlay>`) |
| `Esc` | Exit comment mode / close popover / close thread list |

## Backend adapter interface

The library is storage-agnostic. Implement seven async methods:

```ts
import type { BackendAdapter } from 'react-pinmark';

const myBackend: BackendAdapter = {
  getThreads:    async ({ projectId, pageUrl, status }) => Thread[],
  createThread:  async (input) => Thread,
  updateThread:  async (id, patch, actor) => Thread, // record a status_changed event by actor if you keep history
  deleteThread:  async (id) => void,
  getComments:   async (threadId) => Comment[],
  createComment: async (input) => Comment,
  deleteComment: async (id) => void,
};
```

`status` in `getThreads` is a single status, `'active'` (open + pending) or `'all'`. Use the exported `matchesStatusFilter(thread.status, status)` helper so you don't have to reimplement that logic.

## Thread statuses

| Status | Meaning | Active? |
|---|---|---|
| `open` | Raised, needs action | yes |
| `pending` | Fix is done, waiting for the reporter to check it | yes |
| `resolved` | Reporter confirmed the fix | no |
| `dismissed` | Won't fix, by design, or a duplicate | no |

Active threads are shown in the overlay by default and counted in the unresolved badge. The full list is exported as `THREAD_STATUSES`.

**Status history.** Every status change records who made it and when. The popover shows it between the comments ("Claude → Pending · 2h ago"). The Supabase adapter stores it in `rc_thread_events` (migration 007). If that table is missing, threads load without history.

**Waiting for you.** Saving your name creates a random author id, kept in `localStorage` with the name. Renaming keeps the id. A thread is *waiting for you* when it is `pending` and you opened it (its first comment carries your id). The list button shows an amber count of these threads across all pages, and the thread list has a **Waiting for you** filter. Comments written before author ids existed don't match anyone.

## Attachment adapter interface

```ts
import type { AttachmentAdapter } from 'react-pinmark';

const myAttachmentAdapter: AttachmentAdapter = {
  uploadAttachment: async (file: File | Blob) => Attachment,
  // Attachment: { id: string, url: string, width?: number, height?: number }
};
```

## Supabase quickstart

### 1. Install the Supabase client

```bash
npm install @supabase/supabase-js
```

### 2. Run the migrations

The SQL files ship with the package in `node_modules/react-pinmark/src/adapters/supabase/migrations/`. In the Supabase dashboard → **SQL Editor**, run them in order:

1. `001_create_threads.sql`: the `rc_threads` table with RLS
2. `002_create_comments.sql`: the `rc_comments` table with RLS
3. `003_create_storage.sql`: the `rc-attachments` storage bucket
4. `004_add_delete_policies.sql` and `005_grant_anon_access.sql`: fixes for databases created with older versions. On a fresh install they change nothing.
5. `006_extend_thread_status.sql`: enables the `pending` and `dismissed` statuses
6. `007_create_thread_events.sql`: the status history table

Every migration is safe to re-run, so after upgrading react-pinmark you can run them all again.

### 3. Wire up the adapter

```tsx
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdapter } from 'react-pinmark/supabase';
import { CommentProvider, CommentOverlay } from 'react-pinmark';
import 'react-pinmark/styles';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const adapter = createSupabaseAdapter({ supabaseClient: supabase });

// adapter satisfies both BackendAdapter and AttachmentAdapter
export default function App() {
  return (
    <CommentProvider
      backend={adapter}
      attachmentAdapter={adapter}
      projectId="my-app"
      captureScreenshot={true}
    >
      <YourApp />
      <CommentOverlay />
    </CommentProvider>
  );
}
```

## CSS theming

Override CSS custom properties on `.rc-root`:

```css
.rc-root {
  --rc-color-primary:         #0070f3;
  --rc-color-primary-hover:   #005cc5;
  --rc-color-bg:              #ffffff;
  --rc-color-text:            #171717;
  --rc-color-text-secondary:  #6b7280;
  --rc-color-border:          #e5e7eb;
  --rc-color-surface:         #f9fafb;
  --rc-color-resolved:        #9ca3af;
  --rc-color-pending:         #d97706;
  --rc-font-family:           -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --rc-font-size:             13px;
  --rc-radius:                8px;
  --rc-shadow:                0 4px 24px rgba(0, 0, 0, 0.12);
}
```

## Screenshot capture

When `captureScreenshot={true}` is set on `<CommentProvider>`, the library captures a JPEG screenshot of the viewport when the user places a pin. The screenshot is uploaded via `attachmentAdapter` and prepended to the thread's attachments.

`html-to-image` is loaded lazily — it is not included in the initial bundle unless screenshot capture is actually triggered.

### Excluding elements from screenshots

Add the class `rc-screenshot-hide` to any element that should be omitted from captured screenshots (e.g. fixed UI chrome, hint bars, cookie banners):

```html
<div class="my-hint-bar rc-screenshot-hide">...</div>
```

The overlay's own UI (pins, floating buttons) is always excluded automatically.

## MCP server (AI assistant integration)

react-pinmark ships a [Model Context Protocol](https://modelcontextprotocol.io/) server that lets AI assistants (Claude Code, Cursor, etc.) manage review threads directly.

### Available tools

| Tool | Description |
|---|---|
| `pinmark_list_threads` | List threads, optionally filtered by status or page URL |
| `pinmark_get_comments` | Get all comments for a thread |
| `pinmark_add_comment` | Add a comment to a thread |
| `pinmark_set_thread_status` | Set a thread to `open`, `pending`, `resolved` or `dismissed`. Optional `author` names who made the change in the status history (default `MCP`). |
| `pinmark_delete_thread` | Delete a thread and its comments |
| `pinmark_delete_comment` | Delete a specific comment |
| `pinmark_export` | Export threads as JSON or Markdown |

The tool description tells agents to set a thread to `pending` after addressing it, rather than `resolved`. The reporter then confirms the fix in the UI (**Confirm fix**) or reopens the thread.

### Setup with Claude Code

1. Build the MCP server:

```bash
npm run build
```

2. Copy the example settings and fill in your credentials:

```bash
cp .claude/settings.json.example .claude/settings.json
```

Edit `.claude/settings.json` with your Supabase URL, anon key, and project ID. If you already have a `.pinmarkrc` or `PINMARK_*` environment variables configured, you can omit the `env` block — the server uses the same config resolution as the CLI.

3. Restart Claude Code. The `pinmark_*` tools will be available automatically.

### Alternative: global install

```bash
npm install -g react-pinmark
```

Then in `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "pinmark": {
      "command": "react-pinmark-mcp",
      "env": {
        "PINMARK_SUPABASE_URL": "https://YOUR_PROJECT.supabase.co",
        "PINMARK_SUPABASE_ANON_KEY": "YOUR_ANON_KEY",
        "PINMARK_PROJECT_ID": "YOUR_PROJECT_ID"
      }
    }
  }
}
```

### CLI

The same operations are available via the CLI:

```bash
npx react-pinmark threads list --status active
npx react-pinmark threads status <thread-id> pending --author Claude
npx react-pinmark comments add <thread-id> --body "Fixed in latest deploy"
npx react-pinmark export --format markdown
```

Run `npx react-pinmark --help` for the full command list.

The CLI and MCP server read their settings in this order, and the first source that sets a value wins:

1. CLI flags
2. `PINMARK_*` environment variables
3. The nearest directory, walking up from the current one, whose `.pinmarkrc`, `.env.pinmark` or `.env` contains pinmark settings
4. For the project ID only, a scan of your source code for `projectId`

## License

MIT
