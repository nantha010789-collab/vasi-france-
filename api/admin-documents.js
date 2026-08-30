export default async function handler(req,res){
 if(!['GET','PATCH'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 const url=process.env.VASI_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return res.status(503).json({error:'Supabase server configuration missing'});
 const auth=req.headers.authorization||'';if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Authentication required'});const token=auth.slice(7),h={apikey:key,Authorization:`Bearer ${key}`};
 const u=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});if(!u.ok)return res.status(401).json({error:'Invalid session'});const user=await u.json();
 const a=await fetch(`${url}/rest/v1/admin_allowlist?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,{headers:h});if(!a.ok||(await a.json()).length===0)return res.status(403).json({error:'Admin access required'});
 if(req.method==='GET'){const r=await fetch(`${url}/rest/v1/driver_documents?select=id,driver_id,document_type,file_path,status,rejection_reason,expires_at,reviewed_at,created_at&order=created_at.desc&limit=100`,{headers:h});if(!r.ok)return res.status(r.status).json({error:'Unable to load documents'});return res.status(200).json(await r.json())}
 const b=typeof req.body==='string'?JSON.parse(req.body||'{}'):req.body||{};const id=String(b.id||''),status=String(b.status||'');if(!id||!['approved','rejected'].includes(status))return res.status(400).json({error:'Document id and approved/rejected status required'});
 const patch={status,reviewed_by:user.id,reviewed_at:new Date().toISOString(),rejection_reason:status==='rejected'?String(b.rejection_reason||'Rejected by administrator'):null};
 const r=await fetch(`${url}/rest/v1/driver_documents?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{...h,'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(patch)});if(!r.ok)return res.status(r.status).json({error:'Unable to review document'});return res.status(200).json((await r.json())[0]||null);
}
