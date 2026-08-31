import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
Deno.serve(async(req)=>{if(req.method!=='POST')return new Response('Method not allowed',{status:405});const b=await req.json().catch(()=>({}));const {data,error}=await sb.rpc('expire_vasi_dispatch_offers');if(error)return Response.json({ok:false,error:error.message},{status:500});return Response.json({ok:true,expired:data ?? 0,job_id:b.job_id ?? null});});