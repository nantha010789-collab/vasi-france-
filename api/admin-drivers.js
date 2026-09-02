export default async function handler(req,res){
 if(!['GET','PATCH'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
 const url=process.env.VASI_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return res.status(503).json({error:'Supabase server configuration missing'});
 const auth=req.headers.authorization||'';if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Authentication required'});
 const token=auth.slice(7), h={apikey:key,Authorization:`Bearer ${key}`};
 const u=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});if(!u.ok)return res.status(401).json({error:'Invalid session'});
 const user=await u.json();const a=await fetch(`${url}/rest/v1/admin_allowlist?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,{headers:h});if(!a.ok||(await a.json()).length===0)return res.status(403).json({error:'Admin access required'});
 if(req.method==='GET'){
  const r=await fetch(`${url}/rest/v1/drivers?select=id,full_name,phone,role,status,rejection_reason,online,verified,latitude,longitude,vehicle_type,vehicle_make,vehicle_model,vehicle_plate,vehicle_color,rating,created_at&order=created_at.desc&limit=100`,{headers:h});
  if(!r.ok)return res.status(r.status).json({error:'Unable to load drivers'});return res.status(200).json(await r.json());
 }
 let body={};try{body=typeof req.body==='string'?JSON.parse(req.body||'{}'):req.body||{}}catch{return res.status(400).json({error:'Invalid JSON body'})}
 const id=String(body.id||'');if(!id)return res.status(400).json({error:'Driver id required'});
 const currentResp=await fetch(`${url}/rest/v1/drivers?select=id,verified,status,online&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:h});
 if(!currentResp.ok)return res.status(currentResp.status).json({error:'Unable to load driver'});
 const current=(await currentResp.json())?.[0];if(!current)return res.status(404).json({error:'Driver not found'});
 const patch={};
 if(typeof body.verified==='boolean'){patch.verified=body.verified;patch.status=body.verified?'approved':'pending';if(body.verified)patch.rejection_reason=null;if(!body.verified)patch.online=false}
 if(typeof body.online==='boolean'){
  if(body.online){const verified=patch.verified??current.verified;const status=patch.status??current.status;if(!verified||status!=='approved')return res.status(409).json({error:'Driver must be approved and verified before going online'});}
  patch.online=body.online;
 }
 if(body.status==='approved'){patch.status='approved';patch.verified=true;patch.rejection_reason=null}
 if(body.status==='pending'){patch.status='pending';patch.verified=false;patch.online=false;patch.rejection_reason=null}
 if(body.status==='rejected'){patch.status='rejected';patch.verified=false;patch.online=false;patch.rejection_reason=String(body.rejection_reason||'Documents not approved').slice(0,500)}
 if(!Object.keys(patch).length)return res.status(400).json({error:'No supported change'});
 const r=await fetch(`${url}/rest/v1/drivers?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{...h,'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(patch)});if(!r.ok)return res.status(r.status).json({error:'Unable to update driver'});return res.status(200).json((await r.json())[0]||null);
}
