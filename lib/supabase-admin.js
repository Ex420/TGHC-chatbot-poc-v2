import { createClient } from "@supabase/supabase-js";

let client;

// Created lazily (on first use inside a request) rather than at module load,
// so a missing env var fails an actual request instead of `next build`,
// which imports route modules to collect metadata without running them.
export function getSupabaseAdmin() {
  if (!client) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
      );
    }
    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return client;
}
