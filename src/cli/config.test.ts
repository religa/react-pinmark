import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveConfig, parseDotenv } from './config';

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'pinmark-test-'));
}

describe('parseDotenv', () => {
  it('parses key=value pairs', () => {
    const entries = parseDotenv('FOO=bar\nBAZ=qux');
    expect(entries).toEqual([
      ['FOO', 'bar'],
      ['BAZ', 'qux'],
    ]);
  });

  it('skips comments and blank lines', () => {
    const entries = parseDotenv('# comment\n\nFOO=bar\n');
    expect(entries).toEqual([['FOO', 'bar']]);
  });

  it('strips surrounding quotes', () => {
    const entries = parseDotenv('A="hello"\nB=\'world\'');
    expect(entries).toEqual([
      ['A', 'hello'],
      ['B', 'world'],
    ]);
  });

  it('splits on first = only', () => {
    const entries = parseDotenv('URL=https://example.com?a=1');
    expect(entries).toEqual([['URL', 'https://example.com?a=1']]);
  });
});

describe('resolveConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean PINMARK env vars
    delete process.env.PINMARK_SUPABASE_URL;
    delete process.env.PINMARK_SUPABASE_ANON_KEY;
    delete process.env.PINMARK_PROJECT_ID;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('resolves from .pinmarkrc JSON', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, '.pinmarkrc'),
      JSON.stringify({
        supabaseUrl: 'https://rc.supabase.co',
        supabaseAnonKey: 'rc-key',
        projectId: 'rc-project',
      }),
    );

    const config = resolveConfig({}, dir);
    expect(config).toEqual({
      supabaseUrl: 'https://rc.supabase.co',
      supabaseAnonKey: 'rc-key',
      projectId: 'rc-project',
    });
    rmSync(dir, { recursive: true });
  });

  it('resolves from .env.pinmark', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, '.env.pinmark'),
      'PINMARK_SUPABASE_URL=https://envpinmark.supabase.co\nPINMARK_SUPABASE_ANON_KEY=ep-key\nPINMARK_PROJECT_ID=ep-project',
    );

    const config = resolveConfig({}, dir);
    expect(config).toEqual({
      supabaseUrl: 'https://envpinmark.supabase.co',
      supabaseAnonKey: 'ep-key',
      projectId: 'ep-project',
    });
    rmSync(dir, { recursive: true });
  });

  it('resolves from .env (PINMARK_* keys only)', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, '.env'),
      'PINMARK_SUPABASE_URL=https://env.supabase.co\nPINMARK_SUPABASE_ANON_KEY=env-key\nPINMARK_PROJECT_ID=env-project\nOTHER_VAR=ignored',
    );

    const config = resolveConfig({}, dir);
    expect(config).toEqual({
      supabaseUrl: 'https://env.supabase.co',
      supabaseAnonKey: 'env-key',
      projectId: 'env-project',
    });
    rmSync(dir, { recursive: true });
  });

  it('.pinmarkrc takes precedence over .env.pinmark and .env', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, '.pinmarkrc'),
      JSON.stringify({
        supabaseUrl: 'https://rc-wins.supabase.co',
        supabaseAnonKey: 'rc-wins-key',
        projectId: 'rc-wins',
      }),
    );
    writeFileSync(
      join(dir, '.env.pinmark'),
      'PINMARK_SUPABASE_URL=https://should-lose.supabase.co\nPINMARK_SUPABASE_ANON_KEY=should-lose-key\nPINMARK_PROJECT_ID=should-lose',
    );

    const config = resolveConfig({}, dir);
    expect(config.supabaseUrl).toBe('https://rc-wins.supabase.co');
    expect(config.projectId).toBe('rc-wins');
    rmSync(dir, { recursive: true });
  });

  it('resolves from env vars', () => {
    const dir = makeTmpDir(); // no dotfiles
    process.env.PINMARK_SUPABASE_URL = 'https://fromenv.supabase.co';
    process.env.PINMARK_SUPABASE_ANON_KEY = 'fromenv-key';
    process.env.PINMARK_PROJECT_ID = 'fromenv-project';

    const config = resolveConfig({}, dir);
    expect(config).toEqual({
      supabaseUrl: 'https://fromenv.supabase.co',
      supabaseAnonKey: 'fromenv-key',
      projectId: 'fromenv-project',
    });
    rmSync(dir, { recursive: true });
  });

  it('CLI overrides take precedence over all sources', () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, '.pinmarkrc'),
      JSON.stringify({
        supabaseUrl: 'https://file.supabase.co',
        supabaseAnonKey: 'file-key',
        projectId: 'file-project',
      }),
    );
    process.env.PINMARK_SUPABASE_URL = 'https://env.supabase.co';

    const config = resolveConfig(
      {
        supabaseUrl: 'https://override.supabase.co',
        supabaseAnonKey: 'override-key',
        projectId: 'override-project',
      },
      dir,
    );
    expect(config.supabaseUrl).toBe('https://override.supabase.co');
    expect(config.supabaseAnonKey).toBe('override-key');
    expect(config.projectId).toBe('override-project');
    rmSync(dir, { recursive: true });
  });

  it('walks up directories and stops at first dir with dotfile', () => {
    const parent = makeTmpDir();
    const child = join(parent, 'sub');
    mkdirSync(child);

    writeFileSync(
      join(parent, '.pinmarkrc'),
      JSON.stringify({
        supabaseUrl: 'https://parent.supabase.co',
        supabaseAnonKey: 'parent-key',
        projectId: 'parent-project',
      }),
    );

    const config = resolveConfig({}, child);
    expect(config.supabaseUrl).toBe('https://parent.supabase.co');
    rmSync(parent, { recursive: true });
  });

  it('throws with clear message when config is incomplete', () => {
    const dir = makeTmpDir();
    expect(() => resolveConfig({}, dir)).toThrow(
      /Missing pinmark config.*supabaseUrl.*supabaseAnonKey.*projectId/,
    );
    rmSync(dir, { recursive: true });
  });

  it('source scan extracts projectId from JSX', () => {
    const dir = makeTmpDir();
    const srcDir = join(dir, 'src');
    mkdirSync(srcDir);
    writeFileSync(
      join(srcDir, 'App.tsx'),
      `import { CommentProvider } from 'react-pinmark';\n<CommentProvider projectId="my-app" backend={backend}>\n</CommentProvider>`,
    );
    writeFileSync(
      join(dir, '.env.pinmark'),
      'PINMARK_SUPABASE_URL=https://scan.supabase.co\nPINMARK_SUPABASE_ANON_KEY=scan-key',
    );

    const config = resolveConfig({}, dir);
    expect(config.projectId).toBe('my-app');
    rmSync(dir, { recursive: true });
  });
});
