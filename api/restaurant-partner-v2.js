const url=process.env.VASI_SUPABASE_URL||process.env.SUPABASE_URL||'https://vhfyvkrvysrooaqzcxsp.supabase.co';
const key=process.env.VASI_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY||'sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT';
const serviceKey=process.env.VASI_SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY||'';

async function currentUser(auth){
  if(!auth?.startsWith('Bearer '))return null;
  const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:auth}});
  if(!r.ok)return null;
  const u=await r.json().catch(()=>null);
  return u?.id?u:null;
}
async function rest(path,authKey,options={}){
  const r=await fetch(`${url}/rest/v1/${path}`,{...options,headers:{apikey:authKey,Authorization:`Bearer ${authKey}`,'Content-Type':'application/json',...(options.headers||{})}});
  const j=await r.json().catch(()=>null);
  if(!r.ok)throw Object.assign(new Error(j?.message||'Database request failed'),{status:r.status});
  return j;
}
async function repairOwnership(user){
  if(!serviceKey||!user?.email)return null;
  const email=String(user.email).trim().toLowerCase();
  const matches=await rest(`restaurants?select=*&email=ilike.${encodeURIComponent(email)}&order=created_at.asc&limit=2`,serviceKey);
  if(matches.length!==1)return null;
  const restaurant=matches[0];
  if(restaurant.owner_id===user.id)return restaurant;
  const updated=await rest(`restaurants?id=eq.${encodeURIComponent(restaurant.id)}`,serviceKey,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({owner_id:user.id,updated_at:new Date().toISOString()})});
  return updated?.[0]||{...restaurant,owner_id:user.id};
}
async function forward(req){
  const host=req.headers['x-forwarded-host']||req.headers.host;
  const proto=req.headers['x-forwarded-proto']||'https';
  const headers={Authorization:req.headers.authorization||''};
  let body;
  if(req.method==='POST'){
    headers['Content-Type']='application/json';
    body=JSON.stringify(typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}));
  }
  const r=await fetch(`${proto}://${host}/api/restaurant-partner`,{method:req.method,headers,body,cache:'no-store'});
  const text=await r.text();
  return {status:r.status,text,contentType:r.headers.get('content-type')||'application/json'};
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
  try{
    const auth=req.headers.authorization||'';
    const user=await currentUser(auth);
    if(!user)return res.status(401).json({error:'Login required'});
    try{
      const own=await fetch(`${url}/rest/v1/restaurants?select=id&owner_id=eq.${encodeURIComponent(user.id)}&limit=1`,{headers:{apikey:key,Authorization:auth}}).then(async r=>r.ok?r.json():[]);
      if(!own?.length)await repairOwnership(user);
    }catch(_e){}
    const result=await forward(req);
    res.status(result.status);
    res.setHeader('Content-Type',result.contentType);
    return res.send(result.text);
  }catch(e){return res.status(Number(e?.status)||500).json({error:e?.message||'Restaurant account check failed'});}
}
