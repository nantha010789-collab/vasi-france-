const url=process.env.VASI_SUPABASE_URL||process.env.SUPABASE_URL||'';
const key=process.env.VASI_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY||'';
const clean=(v,n=180)=>String(v||'').replace(/\s+/g,' ').trim().slice(0,n);

async function getUser(auth){
  if(!url||!key)throw new Error('Restaurant service is not configured');
  if(!auth?.startsWith('Bearer '))return null;
  const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:auth}});
  if(!r.ok)return null;
  const u=await r.json();
  return u?.id?u:null;
}

async function db(path,auth,options={}){
  const r=await fetch(`${url}/rest/v1/${path}`,{...options,headers:{apikey:key,Authorization:auth,'Content-Type':'application/json',...(options.headers||{})}});
  const data=await r.json().catch(()=>null);
  if(!r.ok)throw new Error(data?.message||'Database request failed');
  return data;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
  try{
    const auth=req.headers.authorization||'';
    const user=await getUser(auth);
    if(!user)return res.status(401).json({error:'Login required'});
    const rows=await db(`restaurants?select=*&owner_id=eq.${encodeURIComponent(user.id)}&order=created_at.asc&limit=1`,auth);
    const restaurant=rows?.[0]||null;
    if(req.method==='GET')return res.status(200).json({restaurant});
    if(!restaurant)return res.status(404).json({error:'Register your restaurant first'});
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):req.body||{};
    const required=['name','legal_name','siret','phone','email','address','city','postal_code','cuisine'];
    if(required.some(k=>clean(body[k]).length<2))return res.status(400).json({error:'Complete all restaurant and business fields'});
    const patch={name:clean(body.name,120),legal_name:clean(body.legal_name,160),siret:clean(body.siret,40),phone:clean(body.phone,40),email:clean(body.email,160),address:clean(body.address,220),city:clean(body.city,100),postal_code:clean(body.postal_code,24),cuisine:clean(body.cuisine,120),delivery_mode:body.delivery_mode==='own'?'own':'vasi',updated_at:new Date().toISOString()};
    const updated=await db(`restaurants?id=eq.${encodeURIComponent(restaurant.id)}&owner_id=eq.${encodeURIComponent(user.id)}`,auth,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});
    return res.status(200).json({restaurant:updated?.[0]||{...restaurant,...patch}});
  }catch(e){return res.status(500).json({error:e?.message||'Restaurant profile update failed'});}
}
