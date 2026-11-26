import type { BackendAdapter } from '../adapters/adapter';
import type { PinmarkConfig } from './config';
import type { CommandOptions } from './commands';
import { exportThreads } from '../utils/export';
import { parseStatusFilter } from '../core/status';

export type { ExportOptions, ExportResult } from '../utils/export';
export { exportThreads } from '../utils/export';

const VALID_FORMATS = new Set(['json', 'markdown']);

export async function exportCommand(
  adapter: BackendAdapter,
  config: PinmarkConfig,
  opts: CommandOptions,
): Promise<void> {
  const format = VALID_FORMATS.has(opts.format ?? '')
    ? (opts.format as 'json' | 'markdown')
    : 'json';
  const status = parseStatusFilter(opts.status);

  const output = await exportThreads(adapter, config.projectId, {
    format,
    status,
    pageUrl: opts.page,
  });
  console.log(output);
}
