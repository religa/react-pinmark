import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanProjectId } from './source-scan';

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'pinmark-scan-'));
}

describe('scanProjectId', () => {
  const dirs: string[] = [];

  function tmpDir(): string {
    const d = makeTmpDir();
    dirs.push(d);
    return d;
  }

  afterEach(() => {
    for (const d of dirs) {
      rmSync(d, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it('returns null when no source files exist', () => {
    expect(scanProjectId(tmpDir())).toBeNull();
  });

  it('returns null when files do not reference react-pinmark', () => {
    const dir = tmpDir();
    writeFileSync(join(dir, 'app.tsx'), 'export default function App() {}');
    expect(scanProjectId(dir)).toBeNull();
  });

  it('extracts projectId from JSX attribute: projectId="value"', () => {
    const dir = tmpDir();
    writeFileSync(
      join(dir, 'App.tsx'),
      `import { CommentProvider } from 'react-pinmark';\n<CommentProvider projectId="my-app" backend={b} />`,
    );
    expect(scanProjectId(dir)).toBe('my-app');
  });

  it('extracts projectId from JSX expression: projectId={"value"}', () => {
    const dir = tmpDir();
    writeFileSync(
      join(dir, 'App.tsx'),
      `import { CommentProvider } from 'react-pinmark';\n<CommentProvider projectId={"expr-app"} backend={b} />`,
    );
    expect(scanProjectId(dir)).toBe('expr-app');
  });

  it('extracts projectId from object notation: projectId: "value"', () => {
    const dir = tmpDir();
    writeFileSync(
      join(dir, 'config.ts'),
      `// react-pinmark config\nconst config = { projectId: "obj-app" };`,
    );
    expect(scanProjectId(dir)).toBe('obj-app');
  });

  it('scans subdirectories', () => {
    const dir = tmpDir();
    const sub = join(dir, 'src');
    mkdirSync(sub);
    writeFileSync(
      join(sub, 'App.tsx'),
      `import { CommentProvider } from 'react-pinmark';\n<CommentProvider projectId="nested-app" />`,
    );
    expect(scanProjectId(dir)).toBe('nested-app');
  });

  it('skips node_modules', () => {
    const dir = tmpDir();
    const nm = join(dir, 'node_modules', 'some-pkg');
    mkdirSync(nm, { recursive: true });
    writeFileSync(
      join(nm, 'index.tsx'),
      `import { CommentProvider } from 'react-pinmark';\n<CommentProvider projectId="should-skip" />`,
    );
    expect(scanProjectId(dir)).toBeNull();
  });

  it('skips hidden directories', () => {
    const dir = tmpDir();
    const hidden = join(dir, '.hidden');
    mkdirSync(hidden);
    writeFileSync(
      join(hidden, 'index.tsx'),
      `import { CommentProvider } from 'react-pinmark';\n<CommentProvider projectId="hidden-app" />`,
    );
    expect(scanProjectId(dir)).toBeNull();
  });

  it('respects max depth limit', () => {
    const dir = tmpDir();
    // Create a deeply nested structure (depth > 4)
    let current = dir;
    for (let i = 0; i < 6; i++) {
      current = join(current, `level${i}`);
      mkdirSync(current);
    }
    writeFileSync(
      join(current, 'App.tsx'),
      `import { CommentProvider } from 'react-pinmark';\n<CommentProvider projectId="deep-app" />`,
    );
    expect(scanProjectId(dir)).toBeNull();
  });

  it('only scans supported file extensions', () => {
    const dir = tmpDir();
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({ projectId: 'json-app' }),
    );
    writeFileSync(
      join(dir, 'readme.md'),
      `react-pinmark projectId="md-app"`,
    );
    expect(scanProjectId(dir)).toBeNull();
  });
});
