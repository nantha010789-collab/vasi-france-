export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "GET required" });
  res.setHeader("Cache-Control", "no-store");
  const publishableKey =
    process.env.STRIPE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey)
    return res.status(200).json({ enabled: false, publishable_key: null });
  const secretKey=process.env.STRIPE_SECRET_KEY||'';
  const mode=publishableKey.startsWith('pk_test_')?'test':publishableKey.startsWith('pk_live_')?'live':'invalid';
  const secretMode=/^(sk|rk)_test_/.test(secretKey)?'test':/^(sk|rk)_live_/.test(secretKey)?'live':'missing';
  if(mode==='invalid'||mode!==secretMode)return res.status(200).json({enabled:false,publishable_key:null,mode,reason:'configuration_incomplete'});
  if(req.query?.service==='food'&&!process.env.SUPABASE_SERVICE_ROLE_KEY)return res.status(200).json({enabled:false,publishable_key:null,mode,reason:'configuration_incomplete'});
  const authorization=req.headers?.authorization||'';
  if(!authorization.startsWith('Bearer '))return res.status(200).json({enabled:false,publishable_key:null,mode,reason:'login_required'});
  try{
    const base=process.env.VASI_SUPABASE_URL||process.env.SUPABASE_URL||'https://vhfyvkrvysrooaqzcxsp.supabase.co';
    const accountResponse=await fetch('https://api.stripe.com/v1/account',{headers:{Authorization:`Bearer ${secretKey}`},signal:AbortSignal.timeout(10000)});
    const account=await accountResponse.json();
    if(!accountResponse.ok||!account.id)throw Error('Payment account unavailable');
    const key=process.env.VASI_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY||'sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT';
    const backendResponse=await fetch(`${base}/functions/v1/parcel-payment-service`,{method:'POST',headers:{Authorization:authorization,apikey:key,'Content-Type':'application/json'},body:JSON.stringify({action:'payment_config',website_account_id:account.id,mode}),signal:AbortSignal.timeout(15000)});
    const backend=await backendResponse.json();
    const enabled=backendResponse.ok&&backend.enabled===true&&backend.mode===mode;
    return res.status(200).json({enabled,publishable_key:enabled?publishableKey:null,mode,...(enabled?{}:{reason:'configuration_incomplete'})});
  }catch{return res.status(200).json({enabled:false,publishable_key:null,mode,reason:'configuration_unavailable'});}
}
