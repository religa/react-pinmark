import type { BackendAdapter } from '../adapters/adapter';
import type { Thread } from '../core/types';

export interface ExportOptions {
  format: 'json' | 'markdown';
  status?: 'open' | 'resolved' | 'all';
  pageUrl?: string;
}

export interface ExportResult {
  projectId: string;
  exportedAt: string;
  threadCount: number;
  threads: Thread[];
}

export async function exportThreads(
  adapter: BackendAdapter,
  projectId: string,
  options: ExportOptions,
): Promise<string> {
  const threads = await adapter.getThreads({
    projectId,
    status: options.status ?? 'all',
    pageUrl: options.pageUrl,
  });

  if (options.format === 'json') {
    return formatExportJson(projectId, threads);
  }
  return formatExportMarkdown(projectId, threads);
}

function formatExportJson(projectId: string, threads: Thread[]): string {
  const result: ExportResult = {
    projectId,
    exportedAt: new Date().toISOString(),
    threadCount: threads.length,
    threads,
  };
  return JSON.stringify(result, null, 2);
}

function formatExportMarkdown(projectId: string, threads: Thread[]): string {
  const open = threads.filter((t) => t.status === 'open').length;
  const resolved = threads.filter((t) => t.status === 'resolved').length;
  const lines: string[] = [];

  lines.push(`# Feedback Report — ${projectId}`);
  lines.push('');
  lines.push(
    `Exported: ${new Date().toISOString()} | Threads: ${threads.length} (open: ${open}, resolved: ${resolved})`,
  );

  // Group by pageUrl
  const byPage = new Map<string, Thread[]>();
  for (const thread of threads) {
    const page = thread.pageUrl;
    if (!byPage.has(page)) byPage.set(page, []);
    byPage.get(page)!.push(thread);
  }

  for (const [pageUrl, pageThreads] of byPage) {
    lines.push('');
    lines.push(`## ${pageUrl}`);

    // Sort by createdAt ascending within page
    pageThreads.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    for (let i = 0; i < pageThreads.length; i++) {
      const thread = pageThreads[i];
      lines.push('');
      lines.push(`### Thread #${i + 1} — ${thread.status}`);
      if (thread.comments.length > 0) {
        lines.push(`> ${thread.comments[0].body.slice(0, 120)}`);
      }
      lines.push('');

      for (const comment of thread.comments) {
        lines.push(
          `**${comment.author.displayName}** (${comment.createdAt}):`,
        );
        lines.push(comment.body);
        lines.push('');
      }
      lines.push('---');
    }
  }

  return lines.join('\n');
}
