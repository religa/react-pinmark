import type { Thread, Comment } from '../core/types';

export function formatThreadsTable(threads: Thread[]): string {
  if (threads.length === 0) return 'No threads found.';

  const rows = threads.map((t) => ({
    id: t.id,
    status: t.status,
    page: t.pageUrl,
    preview: t.comments[0]?.body.slice(0, 60) ?? '',
    comments: String(t.comments.length),
    created: t.createdAt,
  }));

  return formatTable(rows, ['id', 'status', 'page', 'preview', 'comments', 'created']);
}

export function formatCommentsTable(comments: Comment[]): string {
  if (comments.length === 0) return 'No comments found.';

  const rows = comments.map((c) => ({
    id: c.id,
    author: c.author.displayName,
    body: c.body.slice(0, 80),
    created: c.createdAt,
  }));

  return formatTable(rows, ['id', 'author', 'body', 'created']);
}

function formatTable(
  rows: Record<string, string>[],
  columns: string[],
): string {
  const widths: Record<string, number> = {};
  for (const col of columns) {
    widths[col] = col.length;
    for (const row of rows) {
      widths[col] = Math.max(widths[col], (row[col] ?? '').length);
    }
  }

  const header = columns.map((col) => col.toUpperCase().padEnd(widths[col])).join('  ');
  const separator = columns.map((col) => '-'.repeat(widths[col])).join('  ');
  const body = rows
    .map((row) =>
      columns.map((col) => (row[col] ?? '').padEnd(widths[col])).join('  '),
    )
    .join('\n');

  return `${header}\n${separator}\n${body}`;
}
