import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  // Keep this visible in dev to avoid silent auth failures.
  console.warn('Supabase client is missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
}

export const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseAnonKey) : null;

// CommCollab v3: spec imports createBrowserClient from @/lib/supabase.
// Returns the existing singleton — no @supabase/ssr needed. (C-08)
export function createBrowserClient() {
  return supabase!;
}
