import { createClient } from "@supabase/supabase-js";

let client;

// The anon key is meant to be public (shipped to the browser); it only
// allows what the Storage policies on the "pdfs" bucket explicitly grant
// (insert-only -- see supabase/schema.sql), so it can't read, list, or
// delete documents the way the server-side service role key can.
export function getSupabaseBrowser() {
  if (!client) {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables"
      );
    }
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    );
  }
  return client;
}
