const url=process.env.VASI_SUPABASE_URL||process.env.SUPABASE_URL||'https://vhfyvkrvysrooaqzcxsp.supabase.co';
const key=process.env.VASI_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY||'sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT';
const clean=(v,n=300)=>String(v||'').replace(/\s+/g,' ').trim().slice(0,n);

async function rpc(name,auth,body){
  const r=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>null);
  if(!r.ok)throw Object.assign(new Error(j?.message||'Menu update failed'),{status:r.status});
  return j;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'POST required'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Login required'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):req.body||{};
    const price=Number(body.price);
    if(!body.id||clean(body.name,100).length<2||!Number.isFinite(price))return res.status(400).json({error:'Enter a valid item name and price'});
    const item=await rpc('vasi_restaurant_update_item',auth,{
      p_item_id:String(body.id),
      p_name:clean(body.name,100),
      p_description:clean(body.description,300),
      p_category:clean(body.category,60)||'Menu',
      p_price:price,
      p_allergens:clean(body.allergens,300).split(',').map(v=>v.trim()).filter(Boolean),
      p_active:body.active!==false&&body.active!=='false'
    });
    return res.status(200).json({item});
  }catch(e){return res.status(Number(e?.status)||500).json({error:e?.message||'Menu update failed'});}
}
