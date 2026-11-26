import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { scanProjectId } from './source-scan';

export interface PinmarkConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  projectId: string;
}

const ENV_KEY_MAP: Record<string, keyof PinmarkConfig> = {
  PINMARK_SUPABASE_URL: 'supabaseUrl',
  PINMARK_SUPABASE_ANON_KEY: 'supabaseAnonKey',
  PINMARK_PROJECT_ID: 'projectId',
};

export function resolveConfig(
  overrides?: Partial<PinmarkConfig>,
  cwd?: string,
): PinmarkConfig {
  const config: Partial<PinmarkConfig> = { ...overrides };
  const startDir = cwd ?? process.cwd();

  // 2. Environment variables — beat files, so CI/shell settings can't be
  //    silently overridden by a checked-in or stale dotfile.
  mergeEnvVars(config);

  // 3. Dotfiles — walk up from cwd
  if (!isComplete(config)) {
    mergeDotfiles(config, startDir);
  }

  // 4. Source scan (projectId only)
  if (!config.projectId) {
    config.projectId = scanProjectId(startDir) ?? undefined;
  }

  // Validate
  const missing: string[] = [];
  if (!config.supabaseUrl) missing.push('supabaseUrl (PINMARK_SUPABASE_URL)');
  if (!config.supabaseAnonKey)
    missing.push('supabaseAnonKey (PINMARK_SUPABASE_ANON_KEY)');
  if (!config.projectId) missing.push('projectId (PINMARK_PROJECT_ID)');

  if (missing.length > 0) {
    throw new Error(
      `Missing pinmark config: ${missing.join(', ')}. ` +
        'Provide via CLI flags, PINMARK_* environment variables, .pinmarkrc, .env.pinmark, or .env.',
    );
  }

  return config as PinmarkConfig;
}

function isComplete(config: Partial<PinmarkConfig>): boolean {
  return !!(config.supabaseUrl && config.supabaseAnonKey && config.projectId);
}

/**
 * Walks up from startDir to the nearest directory whose dotfiles define at least
 * one pinmark setting, and merges from that directory only. A directory whose
 * dotfiles have no pinmark keys (e.g. an app's plain .env) does not stop the walk.
 */
function mergeDotfiles(
  config: Partial<PinmarkConfig>,
  startDir: string,
): void {
  let dir = resolve(startDir);

  while (true) {
    const found = readDirConfig(dir);
    if (Object.keys(found).length > 0) {
      for (const [field, value] of Object.entries(found) as [keyof PinmarkConfig, string][]) {
        if (!config[field]) config[field] = value;
      }
      return;
    }

    if (dirname(dir) === dir) return; // reached filesystem root
    dir = dirname(dir);
  }
}

/** Pinmark settings defined in one directory. Precedence: .pinmarkrc > .env.pinmark > .env */
function readDirConfig(dir: string): Partial<PinmarkConfig> {
  const found: Partial<PinmarkConfig> = {};

  const rcPath = join(dir, '.pinmarkrc');
  if (existsSync(rcPath)) {
    try {
      const json = JSON.parse(readFileSync(rcPath, 'utf-8'));
      for (const field of Object.values(ENV_KEY_MAP)) {
        if (typeof json[field] === 'string' && json[field]) found[field] = json[field];
      }
    } catch {
      // skip malformed JSON
    }
  }

  for (const name of ['.env.pinmark', '.env']) {
    const path = join(dir, name);
    if (!existsSync(path)) continue;
    for (const [key, value] of parseDotenv(readFileSync(path, 'utf-8'))) {
      const field = ENV_KEY_MAP[key];
      if (field && value && !found[field]) found[field] = value;
    }
  }

  return found;
}

function mergeEnvVars(config: Partial<PinmarkConfig>): void {
  for (const [envKey, field] of Object.entries(ENV_KEY_MAP)) {
    if (!config[field] && process.env[envKey]) {
      (config as Record<string, string>)[field] = process.env[envKey]!;
    }
  }
}

export function parseDotenv(content: string): [string, string][] {
  const result: [string, string][] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result.push([key, value]);
  }
  return result;
}
