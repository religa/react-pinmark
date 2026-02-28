import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdapter } from 'react-pinmark/supabase';
import { CommentProvider, CommentOverlay } from 'react-pinmark';
import type { BackendAdapter, AttachmentAdapter } from 'react-pinmark';
import { mockBackend } from './mock-backend';

// Use Supabase if env vars are present, otherwise fall back to the localStorage mock
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const usingSupabase = Boolean(supabaseUrl && supabaseKey);

const supabaseAdapter = usingSupabase
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ? createSupabaseAdapter({ supabaseClient: createClient(supabaseUrl!, supabaseKey!) as any })
  : null;

const backend: BackendAdapter = supabaseAdapter ?? mockBackend;
const attachmentAdapter: AttachmentAdapter | undefined = supabaseAdapter ?? undefined;

type ColorScheme = 'system' | 'light' | 'dark';

const SCHEME_ICONS: Record<ColorScheme, string> = {
  system: '◑',
  light: '☀',
  dark: '☾',
};
const SCHEME_ORDER: ColorScheme[] = ['system', 'light', 'dark'];

export default function App() {
  const [colorScheme, setColorScheme] = useState<ColorScheme>('system');
  const [hideResolved, setHideResolved] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorScheme);
  }, [colorScheme]);

  const cycleScheme = () => {
    setColorScheme((c) => {
      const idx = SCHEME_ORDER.indexOf(c);
      return SCHEME_ORDER[(idx + 1) % SCHEME_ORDER.length];
    });
  };

  return (
    <CommentProvider
      backend={backend}
      attachmentAdapter={attachmentAdapter}
      projectId="rc-demo"
      colorScheme={colorScheme}
      captureScreenshot={true}
    >
      <div className="demo-layout">
        {/* ── Nav ─────────────────────────────────────────────── */}
        <header className="demo-nav">
          <div className="demo-nav-inner">
            <a href="#" className="demo-logo">
              <span className="demo-logo-mark">rc</span>
              <span className="demo-logo-name">react-pinmark</span>
              <span className="demo-logo-version">v0.1</span>
            </a>
            <div className="demo-nav-controls">
              <label className="demo-toggle-label">
                <input
                  type="checkbox"
                  checked={!hideResolved}
                  onChange={(e) => setHideResolved(!e.target.checked)}
                  className="demo-toggle-input"
                />
                <span className="demo-toggle-track">
                  <span className="demo-toggle-thumb" />
                </span>
                <span className="demo-toggle-text">Show resolved</span>
              </label>
              <button
                className="demo-scheme-btn"
                onClick={cycleScheme}
                title={`Color scheme: ${colorScheme}`}
                aria-label="Toggle color scheme"
              >
                {SCHEME_ICONS[colorScheme]}
              </button>
            </div>
          </div>
        </header>

        {/* ── Content ─────────────────────────────────────────── */}
        <main className="demo-main">
          {/* Hero */}
          <section className="demo-hero" data-comment-anchor="hero">
            <div className="demo-hero-eyebrow">Open source · MIT license</div>
            <h1 className="demo-hero-title">
              Comments that live<br />
              <em>on the page.</em>
            </h1>
            <p className="demo-hero-sub">
              Drop a commenting overlay into any React app in minutes.
              Users click to pin comments anywhere — no separate tool, no context switching.
            </p>
            <div className="demo-hero-actions">
              <code className="demo-hero-install">npm install react-pinmark</code>
            </div>
          </section>

          {/* Section 01 — Quick start */}
          <section className="demo-section" data-comment-anchor="quick-start">
            <div className="demo-section-header">
              <span className="demo-section-num">01</span>
              <h2 className="demo-section-title">Quick start</h2>
            </div>
            <p className="demo-prose">
              Wrap your app in <code>CommentProvider</code>, drop in{' '}
              <code>CommentOverlay</code>, and pass a backend adapter. That's it.
              No build plugins, no SDK, no iframe.
            </p>
            <div className="demo-code-block">
              <div className="demo-code-header">
                <span className="demo-code-filename">App.tsx</span>
                <div className="demo-code-dots">
                  <span /><span /><span />
                </div>
              </div>
              <pre className="demo-code-pre"><code>{`import { CommentProvider, CommentOverlay } from 'react-pinmark';
import { createSupabaseAdapter } from 'react-pinmark/supabase';
import 'react-pinmark/dist/index.css';

const backend = createSupabaseAdapter({ supabaseClient });

export default function App() {
  return (
    <CommentProvider backend={backend} projectId="my-app">
      <YourApp />
      <CommentOverlay />
    </CommentProvider>
  );
}`}</code></pre>
            </div>
            <p className="demo-prose">
              The overlay renders via a React portal — it sits outside your DOM
              tree entirely, so it never conflicts with your layout or z-index
              stacking contexts.
            </p>
          </section>

          {/* Section 02 — How it works */}
          <section className="demo-section" data-comment-anchor="how-it-works">
            <div className="demo-section-header">
              <span className="demo-section-num">02</span>
              <h2 className="demo-section-title">How it works</h2>
            </div>
            <p className="demo-prose">
              Every comment is pinned to a coordinate on the page. The library
              stores the position two ways — a percentage of viewport width plus
              an absolute scroll offset, and optionally a CSS selector for
              anchoring to a specific element. The selector takes precedence, so
              pins stay attached to content even as layouts reflow.
            </p>
            <div className="demo-features">
              <div className="demo-feature">
                <div className="demo-feature-icon">⊕</div>
                <div>
                  <h3 className="demo-feature-title">Pin placement</h3>
                  <p className="demo-feature-desc">
                    Press <kbd>C</kbd> to enter comment mode — the cursor becomes
                    a crosshair. Click anywhere on the page. A numbered circle
                    appears at that point and a composer opens beside it.
                  </p>
                </div>
              </div>
              <div className="demo-feature">
                <div className="demo-feature-icon">⊞</div>
                <div>
                  <h3 className="demo-feature-title">Thread management</h3>
                  <p className="demo-feature-desc">
                    Threads can be replied to, resolved, and reopened. Resolved
                    threads are hidden from the overlay by default — use{' '}
                    <code>hideResolved=&#123;false&#125;</code> to keep them
                    visible. The thread list panel lets you browse and filter all
                    threads across pages.
                  </p>
                </div>
              </div>
              <div className="demo-feature">
                <div className="demo-feature-icon">⊙</div>
                <div>
                  <h3 className="demo-feature-title">Author identity</h3>
                  <p className="demo-feature-desc">
                    On first comment, users enter a display name that persists in{' '}
                    <code>localStorage</code>. Pass an <code>author</code> prop
                    to <code>CommentProvider</code> to skip the prompt and bind
                    to your own auth system.
                  </p>
                </div>
              </div>
              <div className="demo-feature">
                <div className="demo-feature-icon">⊡</div>
                <div>
                  <h3 className="demo-feature-title">Image attachments</h3>
                  <p className="demo-feature-desc">
                    Pass an <code>attachmentAdapter</code> to enable image
                    uploads. Users can click the attach button or paste an image
                    directly from the clipboard. Previews appear inline before
                    posting.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 03 — Configuration */}
          <section className="demo-section" data-comment-anchor="configuration">
            <div className="demo-section-header">
              <span className="demo-section-num">03</span>
              <h2 className="demo-section-title">Configuration</h2>
            </div>
            <p className="demo-prose">
              <code>CommentProvider</code> accepts a small set of props. Most
              have sensible defaults.
            </p>
            <div className="demo-table-wrap">
              <table className="demo-table">
                <thead>
                  <tr>
                    <th>Prop</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>backend</code></td>
                    <td>BackendAdapter</td>
                    <td>—</td>
                    <td>Required. Storage adapter for threads and comments.</td>
                  </tr>
                  <tr>
                    <td><code>projectId</code></td>
                    <td>string</td>
                    <td>—</td>
                    <td>Required. Namespaces threads to a project.</td>
                  </tr>
                  <tr>
                    <td><code>author</code></td>
                    <td>Author</td>
                    <td>—</td>
                    <td>Override identity. Skips the name prompt.</td>
                  </tr>
                  <tr>
                    <td><code>colorScheme</code></td>
                    <td>'light' | 'dark' | 'system'</td>
                    <td>'system'</td>
                    <td>Controls overlay theme. 'system' follows OS preference.</td>
                  </tr>
                  <tr>
                    <td><code>attachmentAdapter</code></td>
                    <td>AttachmentAdapter</td>
                    <td>—</td>
                    <td>Enables image upload in the composer.</td>
                  </tr>
                  <tr>
                    <td><code>captureScreenshot</code></td>
                    <td>boolean</td>
                    <td>false</td>
                    <td>Auto-capture a viewport screenshot on pin placement. Requires <code>attachmentAdapter</code>.</td>
                  </tr>
                  <tr>
                    <td><code>enabled</code></td>
                    <td>boolean</td>
                    <td>true</td>
                    <td>Mount or unmount the overlay entirely.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 04 — Backend adapter */}
          <section className="demo-section" data-comment-anchor="backends">
            <div className="demo-section-header">
              <span className="demo-section-num">04</span>
              <h2 className="demo-section-title">Backend adapters</h2>
            </div>
            <p className="demo-prose">
              The library is storage-agnostic. A <code>BackendAdapter</code> is
              just an object with five async methods. The included Supabase adapter
              is a thin wrapper — you can write your own for any database, REST
              API, or in-memory store.
            </p>
            <div className="demo-code-block">
              <div className="demo-code-header">
                <span className="demo-code-filename">custom-backend.ts</span>
                <div className="demo-code-dots">
                  <span /><span /><span />
                </div>
              </div>
              <pre className="demo-code-pre"><code>{`import type { BackendAdapter } from 'react-pinmark';

export const myBackend: BackendAdapter = {
  getThreads:    async ({ projectId, pageUrl, status }) => { /* … */ },
  createThread:  async (input) => { /* … */ },
  updateThread:  async (id, patch) => { /* … */ },
  getComments:   async (threadId) => { /* … */ },
  createComment: async (input) => { /* … */ },
};`}</code></pre>
            </div>
            <p className="demo-prose">
              Threads refresh automatically on <code>window.focus</code>, so
              collaborators see each other's comments when they tab back in.
              Call <code>refreshThreads()</code> from <code>useComments()</code>{' '}
              to trigger a manual refresh from anywhere in your app.
            </p>
          </section>
        </main>

        {/* ── Hint card ───────────────────────────────────────── */}
        <div className="demo-hint rc-screenshot-hide" role="note" aria-label="How to leave a comment">
          <div className="demo-hint-step">
            <span className="demo-hint-key">C</span>
            <span>Enter comment mode</span>
          </div>
          <div className="demo-hint-divider" />
          <div className="demo-hint-step">
            <span className="demo-hint-icon">⊕</span>
            <span>Click to place pin</span>
          </div>
          <div className="demo-hint-divider" />
          <div className="demo-hint-step">
            <span className="demo-hint-icon">◎</span>
            <span>Click pin to open</span>
          </div>
        </div>
      </div>

      <CommentOverlay hideResolved={hideResolved} />
    </CommentProvider>
  );
}
