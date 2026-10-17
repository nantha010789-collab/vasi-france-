import { createClient } from 'npm:@supabase/supabase-js@2.115.0';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'private, no-store'}});
async function paymentReadiness(){
  const key=Deno.env.get('STRIPE_SECRET_KEY')||'';
  const mode=/^(sk|rk)_test_/.test(key)?'test':/^(sk|rk)_live_/.test(key)?'live':'missing';
  let accountId=null,accountError=null;
  if(key){try{const r=await fetch('https://api.stripe.com/v1/account',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000)});const a=await r.json();if(r.ok)accountId=a.id;else accountError='Stripe account lookup failed';}catch{accountError='Stripe account lookup unavailable';}}
  return {configured:!!key,mode,account_id:accountId,account_error:accountError,webhook_configured:!!Deno.env.get('STRIPE_WEBHOOK_SECRET')};
}
Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json({error:'POST required'},405);
  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return json({error:'Authentication required'},401);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
  const {data:{user},error}=await db.auth.getUser();
  if(error||!user)return json({error:'Authentication required'},401);
  const body=await req.json().catch(()=>({}));
  if(body.action==='payment_config'){
    const r=await paymentReadiness();
    return json({enabled:r.configured&&r.webhook_configured&&!!r.account_id&&r.account_id===body.website_account_id&&r.mode===body.mode,mode:r.mode});
  }
  if(body.action==='readiness'){
    const response=await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/admin-service`,{method:'POST',headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY')!,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({action:'check_access'})});
    if(!response.ok)return json({error:'Administrator access required'},403);
    return json(await paymentReadiness());
  }
  return json({error:'Parcel payment setup is in progress'},503);
});
