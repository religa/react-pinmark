# react-pinmark

Embeddable pin-based commenting overlay for React applications. Fully implemented — all phases complete.

## Commands

```bash
npm test          # vitest (220 tests across 19 files)
npm run build     # tsup — ESM + CJS + DTS + CSS
npm run typecheck # tsc --noEmit
npm run lint      # eslint src/
npm run demo      # start demo app at localhost:5173
```

## Demo App

`demo/` is a standalone Vite app. It aliases `react-pinmark` directly to `../src/index.ts`
so no build step is needed — editing library source is reflected immediately via HMR.

Comments are persisted to `localStorage` under the key `rc_demo_threads`, so they survive
page reloads. Clear the key in DevTools to reset.

```bash
cd demo && npm install   # first time only
npm run demo             # from project root, or: cd demo && npm run dev
```

### CLI & MCP with the demo

The CLI and MCP server work against any Supabase backend. To use them with the demo's
Supabase instance, create a `.pinmarkrc` or set `PINMARK_*` env vars, then:

```bash
npx react-pinmark threads list              # CLI
node dist/mcp/index.js                      # MCP server (stdio)
```

## Project Structure

```
src/
├── core/
│   ├── types.ts              shared types: Author, Thread, Comment, PinPosition, Attachment, filters
│   ├── state.ts              Zustand vanilla store (createStore — one instance per provider)
│   ├── context-capture.ts    captureContext() — viewport, UA, custom metadata
│   ├── author.ts             getStoredAuthor / setStoredAuthor via localStorage (rc_author key)
│   ├── pin-resolver.ts       resolvePin(), detectSelector(), createPinPosition()
│   └── screenshot.ts         captureViewport() — lazy html-to-image capture; hides .rc-root + rc-screenshot-hide elements
├── adapters/
│   ├── adapter.ts            BackendAdapter (7 methods) + AttachmentAdapter (uploadAttachment) interfaces
│   └── supabase/
│       ├── index.ts          createSupabaseAdapter — implements both interfaces; asPromise() helper
│       └── migrations/       001_create_threads.sql, 002_create_comments.sql, 003_create_storage.sql
├── components/
│   ├── CommentContext.ts     CommentContextValue + useCommentContext() hook
│   ├── CommentProvider.tsx   creates store, fetches threads on mount + window focus
│   ├── CommentOverlay.tsx    portal overlay: pins, popover, thread list, floating buttons, configurable shortcutKey/Esc, screenshot capture
│   ├── Pin.tsx               numbered circle, resolves position, resize-aware, pulse animation
│   ├── ThreadPopover.tsx     comment list (markdown), composer, resolve/unresolve, Esc/click-outside close
│   ├── Composer.tsx          textarea, author prompt, image upload button + paste, attachment previews, screenshot preview
│   ├── AuthorPrompt.tsx      first-time name prompt (persists to localStorage)
│   └── ThreadList.tsx        slide-in panel, page/status filters, thread rows, navigate-to-pin
├── hooks/
│   └── useComments.ts        full UseComments API — state selectors + all actions
├── cli/
│   ├── index.ts              CLI entry point (parseArgs, command dispatch)
│   ├── config.ts             resolveConfig() — dotfiles, env vars, source scan
│   ├── client.ts             createCliAdapter() — Supabase client bridge (bundled into CLI/MCP)
│   ├── commands.ts           thread/comment CRUD commands
│   ├── export.ts             export command (JSON/Markdown)
│   ├── format.ts             table formatters for CLI output
│   └── source-scan.ts        scanProjectId() — find projectId in source files
├── mcp/
│   ├── index.ts              MCP server entry point (stdio transport)
│   └── tools.ts              8 MCP tool definitions + handlers (reuses adapter + config)
├── styles/
│   └── base.css              rc- prefixed CSS, custom properties, dark mode, markdown styles
└── index.ts                  public barrel: CommentProvider, CommentOverlay, ThreadList, useComments, types
```

## Architecture Decisions

- **Zustand vanilla store** (`createStore`, not `create`) so each `<CommentProvider>` gets its own isolated store. Subscribed in React via `useSyncExternalStore`.
- **Portal** in `CommentOverlay` — renders into `document.body` to escape host app stacking contexts.
- **`data-color-scheme`** attribute on `.rc-root` drives dark/light/system CSS variable overrides.
- **micromark** renders comment bodies as Markdown. Raw HTML is blocked by default — safe for `dangerouslySetInnerHTML`.
- **Supabase adapter** wraps Supabase's thenable query builder in a real `Promise` via `asPromise()`.
- **Attachment flow**: `attachmentAdapter` is optional in context. Composer detects its presence to show/hide the upload UI.
- **Screenshot capture**: `captureViewport()` in `screenshot.ts` lazily imports `html-to-image` so it's excluded from the initial bundle. Fired on pin click when `captureScreenshot && attachmentAdapter`. `html-to-image`'s `filter` callback excludes `.rc-root` and `.rc-screenshot-hide` elements. `screenshotRef` is a ref (not state) to avoid re-renders; cleared on Escape and after submit. A 10-second timeout prevents hangs if the capture promise never resolves.
- **Cross-page navigation**: `CommentOverlay` accepts an optional `onNavigatePage` callback. When a user clicks a thread from a different page in the ThreadList, the callback is invoked with the target `pageUrl`. SPA apps provide their router's navigate function; without it, falls back to `window.location.href`. A `pendingNavigateThreadId` state + effect handles scrolling to the pin after the page transition. MPA fallback persists the pending thread in `sessionStorage` (`rc_pending_thread` key) and reads it on mount.
- **CSS** ships as `dist/index.css` — consumers must import it separately.

## Test Conventions

- Component tests use `CommentContext.Provider` directly (with `createCommentStore()` + mock backend) or wrap in `CommentProvider` when store initialization behavior matters.
- localStorage mock: jsdom's localStorage doesn't persist `removeItem`/`clear` reliably — use `vi.stubGlobal('localStorage', createMockStorage())` in `beforeEach`.
- `toBeInTheDocument` TypeScript diagnostics are false positives from the jest-dom type setup — tests pass at runtime.

## Key Files by Concern

| Concern | File |
|---|---|
| Public API | `src/index.ts` |
| All types | `src/core/types.ts` |
| Store shape & actions | `src/core/state.ts` |
| React hook (consumer-facing) | `src/hooks/useComments.ts` |
| Context value shape | `src/components/CommentContext.ts` |
| Pin position math | `src/core/pin-resolver.ts` |
| Supabase backend | `src/adapters/supabase/index.ts` |
| CLI entry + config | `src/cli/index.ts`, `src/cli/config.ts` |
| MCP server | `src/mcp/index.ts`, `src/mcp/tools.ts` |
| All CSS + dark mode | `src/styles/base.css` |

## Bundle

- ESM output is unbundled (preserves module structure) for tree-shaking — `dist/esm/`
- CJS output is bundled for compatibility — `dist/cjs/`
- CSS ships at `dist/index.css` — consumers import `react-pinmark/styles`
- `html-to-image` is lazily imported at runtime — only loaded when `captureViewport()` is first called
- Supabase adapter: separate entry point (`react-pinmark/supabase`), tree-shakeable
- `@supabase/supabase-js` is an optional peer dep for library consumers; bundled into CLI/MCP binaries
- CLI ships at `dist/cli/index.js` — bin `react-pinmark`
- MCP server ships at `dist/mcp/index.js` — bin `react-pinmark-mcp`; `@modelcontextprotocol/sdk` is a devDep (bundled into binary)
- CLI and MCP are excluded from the library ESM build (`!src/cli/**`, `!src/mcp/**` in tsup)

## Design Principles

* **DRY (Don’t Repeat Yourself)**: Define field types, constraints, and docs once, then reuse everywhere (shared packages, generated types, or schema-first models).
* **Single Source of Truth**: One canonical schema drives validation, API contracts, and documentation (for example Zod schemas, OpenAPI, or a shared domain model package).
* **Type Safety**: End-to-end typing from backend to frontend (TypeScript strict mode, typed APIs, and runtime validation that infers static types).
* **YAGNI**: Avoid introducing frameworks, abstractions, or tooling until there is a clear, current need.
* **KISS**: Prefer simple patterns and boring solutions over clever architecture.
* **Clean Code**: No unused exports/imports, no dead code, consistent formatting, linting, and all tests green in CI.
* **Greenfield Project**: Optimize for clarity and forward progress over backward compatibility concerns.

