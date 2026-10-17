import { createHash } from 'node:crypto';
import { callAdminService } from './_admin-service.js';

const SERVICE = 'vasi_rib_onboarding_test';
const ROLES = ['driver', 'courier', 'restaurant'];
const RETURN = 'https://www.vasigo.eu/admin/rib-test.html';
const fault = (message, status = 400) => Object.assign(new Error(message), { status });

// Isolated Stripe TEST accounts only; never links or approves production partners.
export function createRibTestHandler({key, authorize, stripe}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vary', 'Authorization');
    if (!['GET','POST'].includes(req.method)) return res.status(405).json({error:'GET or POST required'});
    if (!req.headers.authorization?.startsWith('Bearer ')) return res.status(401).json({error:'Authentication required'});
    try {
      const admin = await authorize(req);
      if (!admin?.email) throw fault('Administrator access required',403);
      if (!/^(sk|rk)_test_/.test(key || '')) throw fault('Stripe TEST key required. Live accounts are blocked.',503);
      const owner = createHash('sha256').update(admin.email.toLowerCase()).digest('hex');
      let body = req.body || {};
      if (typeof body === 'string') { try {body=JSON.parse(body);} catch {throw fault('Invalid JSON');} }
      const input = req.method==='GET' ? req.query || {} : body;
      const action = req.method==='GET' ? 'status' : input.action;
      if (action==='enable_connect') {
        await stripe('POST','/v1/_unstable/connect/enable',{});
        return res.status(200).json({test_mode:true,status:'connect_enabled'});
      }
      if (action==='backend_readiness') {
        const url=process.env.VASI_SUPABASE_URL||process.env.SUPABASE_URL||'https://vhfyvkrvysrooaqzcxsp.supabase.co';
        const response=await fetch(`${url}/functions/v1/parcel-payment-service`,{method:'POST',headers:{Authorization:req.headers.authorization,apikey:process.env.VASI_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY||'sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT','Content-Type':'application/json'},body:JSON.stringify({action:'readiness'}),signal:AbortSignal.timeout(20000)});
        const result=await response.json();
        if(!response.ok)throw fault(result.error||'Backend readiness unavailable',response.status);
        const website=await stripe('GET','/v1/account');
        return res.status(200).json({test_mode:true,...result,website_account_id:website.id,account_match:!!website.id&&website.id===result.account_id});
      }
      if (!ROLES.includes(input.role)) throw fault('Invalid test role');
      if (!['status','onboard'].includes(action)) throw fault('Unsupported action');
      const owned = a => a?.metadata?.service===SERVICE && a.metadata.owner===owner && a.metadata.role===input.role;
      let account;
      if (input.account) {
        if (!/^acct_[A-Za-z0-9]+$/.test(input.account)) throw fault('Invalid test account');
        account=await stripe('GET',`/v1/accounts/${input.account}`);
        if (!owned(account)) throw fault('Test account access denied',403);
      } else if (action==='onboard') {
        if (!/^[A-Za-z0-9-]{16,80}$/.test(input.request_id || '')) throw fault('Unique test request ID required');
        account=await stripe('POST','/v1/accounts',{
          country:'FR',default_currency:'eur',
          'controller[fees][payer]':'application','controller[losses][payments]':'application',
          'controller[stripe_dashboard][type]':'express','capabilities[transfers][requested]':'true',
          'business_profile[name]':`VASI TEST ${input.role}`,
          'metadata[service]':SERVICE,'metadata[owner]':owner,'metadata[role]':input.role,
        },`rib-test-${owner}-${input.role}-${input.request_id}`);
        if (!owned(account)) throw fault('Stripe test account mismatch',409);
      }
      if (!account) return res.status(200).json({test_mode:true,role:input.role,status:'not_started'});
      if (action==='onboard') {
        const back=`${RETURN}?role=${input.role}&account=${encodeURIComponent(account.id)}`;
        const link=await stripe('POST','/v1/account_links',{
          account:account.id,type:'account_onboarding',return_url:back,refresh_url:`${back}&expired=1`,
        });
        if (!link.url?.startsWith('https://connect.stripe.com/')) throw fault('Invalid Stripe onboarding URL',409);
        return res.status(200).json({test_mode:true,role:input.role,account:account.id,url:link.url});
      }
      const bankAccounts=(account.external_accounts?.data || []).filter(a=>a.object==='bank_account');
      return res.status(200).json({test_mode:true,role:input.role,account:account.id,
        details_submitted:!!account.details_submitted,payouts_enabled:!!account.payouts_enabled,
        bank_added:bankAccounts.length>0,
        status:account.payouts_enabled&&bankAccounts.length>0?'verified':account.details_submitted?'pending':'incomplete',
        requirements:account.requirements?.currently_due || [],
      });
    } catch(e) {return res.status(Number(e.status)||502).json({error:e.message||'RIB test unavailable'});}
  };
}

async function stripe(method,path,params,idem) {
  const headers={Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,'Stripe-Version':path==='/v1/_unstable/connect/enable'?'2026-09-30.preview':'2025-07-30.basil'};
  if(params) headers['Content-Type']='application/x-www-form-urlencoded';
  if(idem) headers['Idempotency-Key']=idem;
  const response=await fetch(`https://api.stripe.com${path}`,{method,headers,...(params?{body:new URLSearchParams(params).toString()}:{}),signal:AbortSignal.timeout(18000)});
  const data=await response.json();
  if(!response.ok) {
    const message=data?.error?.message||'Stripe test request failed';
    if(message.includes("signed up for Connect")) throw fault('Stripe Connect n’est pas activé dans ce sandbox. Activez Connect dans le sandbox Stripe avant de tester l’ajout du RIB.',503);
    throw fault(message,response.status);
  }
  return data;
}
export default async function handler(req,res) {
  return createRibTestHandler({key:process.env.STRIPE_SECRET_KEY,stripe,authorize:async request=>{
    const result=await callAdminService(request,'check_access');
    if(result.status!==200) throw fault('Administrator access required',result.status);
    return {email:result.data.admin_email};
  }})(req,res);
}
