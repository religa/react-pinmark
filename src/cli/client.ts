import type { BackendAdapter } from '../adapters/adapter';
import type { PinmarkConfig } from './config';

export async function createCliAdapter(
  config: PinmarkConfig,
): Promise<BackendAdapter> {
  // Dynamic import — @supabase/supabase-js is a peer dep
  const supabaseModule = '@supabase/supabase-js';
  const { createClient } = (await import(supabaseModule)) as {
    createClient: (url: string, key: string) => unknown;
  };
  const sb = createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { createSupabaseAdapter } = await import(
    '../adapters/supabase/index'
  );
  return createSupabaseAdapter({
    supabaseClient: sb,
  } as Parameters<typeof createSupabaseAdapter>[0]);
}
