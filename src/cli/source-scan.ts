import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  '.git',
  'build',
  'coverage',
]);
const FILE_EXTS = new Set(['.tsx', '.jsx', '.ts', '.js']);
const MAX_DEPTH = 4;

export function scanProjectId(startDir: string): string | null {
  const files = collectSourceFiles(startDir, 0);
  for (const file of files) {
    const id = extractProjectId(file);
    if (id) return id;
  }
  return null;
}

function collectSourceFiles(dir: string, depth: number): string[] {
  if (depth > MAX_DEPTH) return [];
  const files: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  for (const entry of entries) {
    if (entry.startsWith('.') || SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(full, depth + 1));
    } else if (FILE_EXTS.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

function extname(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot);
}

function extractProjectId(filePath: string): string | null {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  // Only check files that reference react-pinmark or CommentProvider
  if (
    !content.includes('react-pinmark') &&
    !content.includes('CommentProvider')
  ) {
    return null;
  }

  // Match projectId="value" or projectId={'value'} or projectId: "value"
  const patterns = [
    /projectId=["']([^"']+)["']/,
    /projectId=\{["']([^"']+)["']\}/,
    /projectId:\s*["']([^"']+)["']/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1];
  }

  return null;
}
