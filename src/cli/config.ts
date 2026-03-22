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

  // 2. Dotfiles — walk up from cwd
  if (!isComplete(config)) {
    mergeDotfiles(config, startDir);
  }

  // 3. Environment variables
  if (!isComplete(config)) {
    mergeEnvVars(config);
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
        'Provide via CLI flags, .pinmarkrc, .env.pinmark, .env, or environment variables.',
    );
  }

  return config as PinmarkConfig;
}

function isComplete(config: Partial<PinmarkConfig>): boolean {
  return !!(config.supabaseUrl && config.supabaseAnonKey && config.projectId);
}

function mergeDotfiles(
  config: Partial<PinmarkConfig>,
  startDir: string,
): void {
  let dir = resolve(startDir);

  while (true) {
    const rcPath = join(dir, '.pinmarkrc');
    const envPinmarkPath = join(dir, '.env.pinmark');
    const envPath = join(dir, '.env');

    const hasAny =
      existsSync(rcPath) || existsSync(envPinmarkPath) || existsSync(envPath);

    if (hasAny) {
      // .pinmarkrc (JSON, camelCase keys)
      if (existsSync(rcPath)) {
        try {
          const json = JSON.parse(readFileSync(rcPath, 'utf-8'));
          if (json.supabaseUrl && !config.supabaseUrl)
            config.supabaseUrl = json.supabaseUrl;
          if (json.supabaseAnonKey && !config.supabaseAnonKey)
            config.supabaseAnonKey = json.supabaseAnonKey;
          if (json.projectId && !config.projectId)
            config.projectId = json.projectId;
        } catch {
          // skip malformed JSON
        }
      }

      // .env.pinmark (dotenv, PINMARK_* keys)
      if (existsSync(envPinmarkPath)) {
        mergeFromDotenv(config, envPinmarkPath);
      }

      // .env (standard dotenv, only PINMARK_* keys)
      if (existsSync(envPath)) {
        mergeFromDotenv(config, envPath);
      }

      break; // stop walking at first directory with any dotfile
    }

    if (dirname(dir) === dir) break; // reached filesystem root
    dir = dirname(dir);
  }
}

function mergeFromDotenv(
  config: Partial<PinmarkConfig>,
  filePath: string,
): void {
  const entries = parseDotenv(readFileSync(filePath, 'utf-8'));
  for (const [key, value] of entries) {
    const field = ENV_KEY_MAP[key];
    if (field && !config[field]) {
      (config as Record<string, string>)[field] = value;
    }
  }
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
