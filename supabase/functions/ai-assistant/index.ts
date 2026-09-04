import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const token = auth.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { task, input } = await req.json().catch(() => ({ task: null, input: {} }));
  const allowed = new Set(["driver_matching", "eta_prediction", "customer_support", "eats_recommendation"]);
  if (!allowed.has(task)) return Response.json({ error: "Unsupported AI task" }, { status: 400 });

  // Provider-neutral boundary: connect the chosen AI provider here using server-only secrets.
  // No AI provider key is exposed to the browser. Until a provider is configured, return a safe status.
  const providerConfigured = Boolean(Deno.env.get("AI_PROVIDER_API_KEY"));
  if (!providerConfigured) return Response.json({ ok: false, configured: false, task, message: "AI backend connection is ready; provider key is not configured." }, { status: 503 });

  return Response.json({ ok: true, configured: true, task, user_id: user.id, input });
});