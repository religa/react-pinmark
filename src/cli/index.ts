import { parseArgs } from 'node:util';
import { resolveConfig } from './config';
import { createCliAdapter } from './client';
import {
  listThreads,
  setThreadStatus,
  deleteThread,
  listComments,
  addComment,
  deleteComment,
} from './commands';
import { exportCommand } from './export';
import { THREAD_STATUSES, STATUS_FILTERS } from '../core/status';

const STATUS_FILTER_USAGE = STATUS_FILTERS.join('|');

const HELP = `react-pinmark — CLI for managing pinmark threads and comments

Usage: react-pinmark <command> <subcommand> [options]

Commands:
  threads list    [--status ${STATUS_FILTER_USAGE}] [--page <url>] [--format json]
  threads status  <thread-id> <${THREAD_STATUSES.join('|')}> [--author <name>]
  threads resolve <thread-id> [--author <name>]   (shorthand for: threads status <id> resolved)
  threads delete  <thread-id>
  comments list   <thread-id> [--format json]
  comments add    <thread-id> --body <text> [--author <name>]
  comments delete <comment-id>
  export          [--format json|markdown] [--status ${STATUS_FILTER_USAGE}] [--page <url>]

Global options:
  --project <id>          Override project ID
  --supabase-url <url>    Override Supabase URL
  --supabase-key <key>    Override Supabase anon key
  --help                  Show this help message
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean', default: false },
      project: { type: 'string' },
      'supabase-url': { type: 'string' },
      'supabase-key': { type: 'string' },
      status: { type: 'string' },
      page: { type: 'string' },
      format: { type: 'string' },
      body: { type: 'string' },
      author: { type: 'string' },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    process.exit(0);
  }

  const config = resolveConfig({
    projectId: values.project,
    supabaseUrl: values['supabase-url'],
    supabaseAnonKey: values['supabase-key'],
  });

  const adapter = createCliAdapter(config);
  const [command, subcommand, arg, arg2] = positionals;

  const opts = {
    status: values.status,
    page: values.page,
    format: values.format,
    body: values.body,
    author: values.author,
  };

  switch (command) {
    case 'threads':
      switch (subcommand) {
        case 'list':
          return listThreads(adapter, config, opts);
        case 'status':
          if (!arg) throw new Error('Usage: threads status <thread-id> <status>');
          return setThreadStatus(adapter, arg, arg2, opts);
        case 'resolve':
          if (!arg) throw new Error('Usage: threads resolve <thread-id>');
          return setThreadStatus(adapter, arg, 'resolved', opts);
        case 'delete':
          if (!arg) throw new Error('Usage: threads delete <thread-id>');
          return deleteThread(adapter, arg);
        default:
          throw new Error(
            `Unknown subcommand: threads ${subcommand ?? '(none)'}`,
          );
      }
    case 'comments':
      switch (subcommand) {
        case 'list':
          if (!arg) throw new Error('Usage: comments list <thread-id>');
          return listComments(adapter, arg, opts);
        case 'add':
          if (!arg) throw new Error('Usage: comments add <thread-id> --body <text>');
          return addComment(adapter, arg, opts);
        case 'delete':
          if (!arg) throw new Error('Usage: comments delete <comment-id>');
          return deleteComment(adapter, arg);
        default:
          throw new Error(
            `Unknown subcommand: comments ${subcommand ?? '(none)'}`,
          );
      }
    case 'export':
      return exportCommand(adapter, config, opts);
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((err: Error) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
