import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { BackendAdapter } from '../adapters/adapter';
import type { PinmarkConfig } from '../cli/config';
import { exportThreads } from '../utils/export';
import {
  THREAD_STATUSES,
  STATUS_FILTERS,
  parseStatusFilter,
  parseThreadStatus,
} from '../core/status';

const STATUS_FILTER_SCHEMA = {
  type: 'string',
  enum: STATUS_FILTERS,
  description:
    'Filter by thread status. "active" = open + pending (needs attention). Default: all',
};

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
        status: STATUS_FILTER_SCHEMA,
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
    name: 'pinmark_set_thread_status',
    description:
      'Change a thread\'s status. After you have addressed a thread, set it to "pending" so the ' +
      'reporter can verify the fix — only use "resolved" when the user explicitly asks you to. ' +
      'Use "dismissed" for won\'t-fix / by-design / duplicate, and "open" to reopen.',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'The thread ID' },
        status: {
          type: 'string',
          enum: THREAD_STATUSES,
          description:
            'open = needs action; pending = fixed, awaiting reporter verification; ' +
            'resolved = verified fixed; dismissed = won\'t fix',
        },
      },
      required: ['threadId', 'status'],
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
        status: STATUS_FILTER_SCHEMA,
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

// The low-level setRequestHandler API does not validate args against inputSchema,
// so every handler validates its own input. Thrown errors become isError results.
function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} is required and must be a non-empty string`);
  }
  return value;
}

function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value;
}

export function buildToolHandlers(
  adapter: BackendAdapter,
  config: PinmarkConfig,
): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  handlers.set('pinmark_list_threads', async (args) => {
    const threads = await adapter.getThreads({
      projectId: config.projectId,
      status: parseStatusFilter(args.status) ?? 'all',
      pageUrl: optionalString(args, 'page'),
    });
    return jsonResult(threads);
  });

  handlers.set('pinmark_get_comments', async (args) => {
    const comments = await adapter.getComments(requireString(args, 'threadId'));
    return jsonResult(comments);
  });

  handlers.set('pinmark_add_comment', async (args) => {
    const comment = await adapter.createComment({
      threadId: requireString(args, 'threadId'),
      body: requireString(args, 'body'),
      author: { displayName: optionalString(args, 'author') ?? 'MCP' },
    });
    return jsonResult(comment);
  });

  handlers.set('pinmark_set_thread_status', async (args) => {
    const thread = await adapter.updateThread(requireString(args, 'threadId'), {
      status: parseThreadStatus(args.status),
    });
    return jsonResult(thread);
  });

  handlers.set('pinmark_delete_thread', async (args) => {
    const threadId = requireString(args, 'threadId');
    await adapter.deleteThread(threadId);
    return jsonResult({ deleted: true, threadId });
  });

  handlers.set('pinmark_delete_comment', async (args) => {
    const commentId = requireString(args, 'commentId');
    await adapter.deleteComment(commentId);
    return jsonResult({ deleted: true, commentId });
  });

  handlers.set('pinmark_export', async (args) => {
    const format = args.format === 'markdown' ? 'markdown' : 'json';
    const output = await exportThreads(adapter, config.projectId, {
      format,
      status: parseStatusFilter(args.status),
      pageUrl: optionalString(args, 'page'),
    });
    // Both formats are already serialized text; JSON-encoding markdown would escape it.
    return { content: [{ type: 'text' as const, text: output }] };
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
