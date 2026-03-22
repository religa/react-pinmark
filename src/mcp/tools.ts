import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { BackendAdapter } from '../adapters/adapter';
import type { PinmarkConfig } from '../cli/config';
import { exportThreads } from '../utils/export';

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TOOLS: ToolDef[] = [
  {
    name: 'pinmark_list_threads',
    description: 'List review threads, optionally filtered by status or page URL',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'resolved', 'all'],
          description: 'Filter by thread status (default: all)',
        },
        page: {
          type: 'string',
          description: 'Filter by page URL',
        },
      },
    },
  },
  {
    name: 'pinmark_get_comments',
    description: 'Get all comments for a specific thread',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'The thread ID' },
      },
      required: ['threadId'],
    },
  },
  {
    name: 'pinmark_add_comment',
    description: 'Add a comment to an existing thread',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'The thread ID' },
        body: { type: 'string', description: 'Comment body (supports Markdown)' },
        author: {
          type: 'string',
          description: 'Author display name (default: MCP)',
        },
      },
      required: ['threadId', 'body'],
    },
  },
  {
    name: 'pinmark_resolve_thread',
    description: 'Mark a thread as resolved',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'The thread ID' },
      },
      required: ['threadId'],
    },
  },
  {
    name: 'pinmark_reopen_thread',
    description: 'Reopen a resolved thread',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'The thread ID' },
      },
      required: ['threadId'],
    },
  },
  {
    name: 'pinmark_delete_thread',
    description: 'Delete a thread and all its comments',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'The thread ID' },
      },
      required: ['threadId'],
    },
  },
  {
    name: 'pinmark_delete_comment',
    description: 'Delete a specific comment',
    inputSchema: {
      type: 'object',
      properties: {
        commentId: { type: 'string', description: 'The comment ID' },
      },
      required: ['commentId'],
    },
  },
  {
    name: 'pinmark_export',
    description: 'Export threads as JSON or Markdown',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['json', 'markdown'],
          description: 'Export format (default: json)',
        },
        status: {
          type: 'string',
          enum: ['open', 'resolved', 'all'],
          description: 'Filter by thread status',
        },
        page: {
          type: 'string',
          description: 'Filter by page URL',
        },
      },
    },
  },
];

function jsonResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}

export type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }>;

const VALID_STATUSES = new Set(['open', 'resolved', 'all']);

function parseStatus(value: unknown): 'open' | 'resolved' | 'all' {
  return typeof value === 'string' && VALID_STATUSES.has(value)
    ? (value as 'open' | 'resolved' | 'all')
    : 'all';
}

export function buildToolHandlers(
  adapter: BackendAdapter,
  config: PinmarkConfig,
): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  handlers.set('pinmark_list_threads', async (args) => {
    const status = parseStatus(args.status);
    const threads = await adapter.getThreads({
      projectId: config.projectId,
      status: status as 'open' | 'resolved' | 'all',
      pageUrl: args.page as string | undefined,
    });
    return jsonResult(threads);
  });

  handlers.set('pinmark_get_comments', async (args) => {
    const comments = await adapter.getComments(args.threadId as string);
    return jsonResult(comments);
  });

  handlers.set('pinmark_add_comment', async (args) => {
    const comment = await adapter.createComment({
      threadId: args.threadId as string,
      body: args.body as string,
      author: { displayName: (args.author as string) ?? 'MCP' },
    });
    return jsonResult(comment);
  });

  handlers.set('pinmark_resolve_thread', async (args) => {
    const thread = await adapter.updateThread(args.threadId as string, {
      status: 'resolved',
    });
    return jsonResult(thread);
  });

  handlers.set('pinmark_reopen_thread', async (args) => {
    const thread = await adapter.updateThread(args.threadId as string, {
      status: 'open',
    });
    return jsonResult(thread);
  });

  handlers.set('pinmark_delete_thread', async (args) => {
    await adapter.deleteThread(args.threadId as string);
    return jsonResult({ deleted: true, threadId: args.threadId });
  });

  handlers.set('pinmark_delete_comment', async (args) => {
    await adapter.deleteComment(args.commentId as string);
    return jsonResult({ deleted: true, commentId: args.commentId });
  });

  handlers.set('pinmark_export', async (args) => {
    const format = args.format === 'markdown' ? 'markdown' : 'json';
    const output = await exportThreads(adapter, config.projectId, {
      format,
      status: parseStatus(args.status),
      pageUrl: args.page as string | undefined,
    });
    if (format === 'json') {
      return { content: [{ type: 'text' as const, text: output }] };
    }
    return jsonResult(output);
  });

  return handlers;
}

export function registerTools(
  server: Server,
  adapter: BackendAdapter,
  config: PinmarkConfig,
): void {
  const handlers = buildToolHandlers(adapter, config);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = handlers.get(name);
    if (!handler) {
      return errorResult(`Unknown tool: ${name}`);
    }
    try {
      return await handler(args ?? {});
    } catch (err) {
      return errorResult(
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  });
}
