// Retired: there must be one approval path with the same review evidence checks.
// The previous endpoint defaulted an omitted status to approved.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
Deno.serve((req) => new Response(JSON.stringify({error:'Use the protected admin-service review_document action with explicit review evidence.'}),{status:410,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}}));
