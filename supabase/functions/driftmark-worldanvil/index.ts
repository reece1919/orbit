import { createClient } from "npm:@supabase/supabase-js@2.75.0";
import { createHandler } from "./core.mjs";
import { createAuthorize } from "./auth.mjs";
import { createConnections } from "./connections.mjs";

const url = Deno.env.get("SUPABASE_URL") || "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
const userClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const serviceClient = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", {
  auth: { persistSession: false, autoRefreshToken: false }
});

Deno.serve(createHandler({
  authorize: createAuthorize(userClient),
  connections: createConnections(serviceClient),
  fetcher: fetch
}));
