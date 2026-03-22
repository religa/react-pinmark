import { createClient } from '@supabase/supabase-js';
import type { BackendAdapter } from '../adapters/adapter';
import { createSupabaseAdapter } from '../adapters/supabase/index';
import type { PinmarkConfig } from './config';

export function createCliAdapter(config: PinmarkConfig): BackendAdapter {
  const sb = createClient(config.supabaseUrl, config.supabaseAnonKey);
  return createSupabaseAdapter({
    supabaseClient: sb as unknown,
  } as Parameters<typeof createSupabaseAdapter>[0]);
}
