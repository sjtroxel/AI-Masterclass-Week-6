import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];
const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl) throw new Error('Missing env: SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing env: SUPABASE_ANON_KEY');
if (!supabaseServiceRoleKey) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');

// Public client — respects RLS. Use for all standard queries.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Privileged client — bypasses RLS. Use only in server-side operations
// and ingestion scripts. Never expose this key to the client.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
