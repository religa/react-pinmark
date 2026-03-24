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
cd demo && npm install   # first time only
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
import 'react-pinmark/dist/index.css';

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
| `author` | `{ displayName: string }` | — | Override identity. Skips the first-time name prompt. |
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
| `hideResolved` | `boolean` | `true` | Hide resolved threads from the overlay. |
| `zIndex` | `number` | `10000` | CSS `z-index` for the overlay root. |
| `shortcutKey` | `string \| null` | `'c'` | Key that toggles comment mode. Pass `null` to disable. |

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
  resolveThread,
  unresolveThread,
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

The library is storage-agnostic. Implement five async methods:

```ts
import type { BackendAdapter } from 'react-pinmark';

const myBackend: BackendAdapter = {
  getThreads:    async ({ projectId, pageUrl, status }) => Thread[],
  createThread:  async (input) => Thread,
  updateThread:  async (id, patch) => Thread,
  getComments:   async (threadId) => Comment[],
  createComment: async (input) => Comment,
};
```

## Attachment adapter interface

```ts
import type { AttachmentAdapter } from 'react-pinmark';

const myAttachmentAdapter: AttachmentAdapter = {
  uploadAttachment: async (file: File | Blob) => ({ id: string, url: string }),
};
```

## Supabase quickstart

### 1. Install the Supabase client

```bash
npm install @supabase/supabase-js
```

### 2. Run the migrations

In the Supabase dashboard → **SQL Editor**, run the three migration files in order:

1. `src/adapters/supabase/migrations/001_create_threads.sql`
2. `src/adapters/supabase/migrations/002_create_comments.sql`
3. `src/adapters/supabase/migrations/003_create_storage.sql`

These create the `rc_threads` and `rc_comments` tables (with RLS) and the `rc-attachments` storage bucket.

### 3. Wire up the adapter

```tsx
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdapter } from 'react-pinmark/supabase';
import { CommentProvider, CommentOverlay } from 'react-pinmark';
import 'react-pinmark/dist/index.css';

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
| `pinmark_resolve_thread` | Mark a thread as resolved |
| `pinmark_reopen_thread` | Reopen a resolved thread |
| `pinmark_delete_thread` | Delete a thread and its comments |
| `pinmark_delete_comment` | Delete a specific comment |
| `pinmark_export` | Export threads as JSON or Markdown |

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
npx react-pinmark threads list --status open
npx react-pinmark comments add <thread-id> --body "Fixed in latest deploy"
npx react-pinmark export --format markdown
```

Run `npx react-pinmark --help` for the full command list.

## License

MIT
