import { parseArgs } from 'node:util';
import { resolveConfig } from './config';
import { createCliAdapter } from './client';
import {
  listThreads,
  resolveThread,
  deleteThread,
  listComments,
  addComment,
  deleteComment,
} from './commands';
import { exportCommand } from './export';

const HELP = `react-pinmark — CLI for managing pinmark threads and comments

Usage: react-pinmark <command> <subcommand> [options]

Commands:
  threads list    [--status open|resolved|all] [--page <url>] [--format json]
  threads resolve <thread-id>
  threads delete  <thread-id>
  comments list   <thread-id> [--format json]
  comments add    <thread-id> --body <text> [--author <name>]
  comments delete <comment-id>
  export          [--format json|markdown] [--status open|resolved|all] [--page <url>]

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

  const adapter = await createCliAdapter(config);
  const [command, subcommand, arg] = positionals;

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
        case 'resolve':
          if (!arg) throw new Error('Usage: threads resolve <thread-id>');
          return resolveThread(adapter, arg);
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
