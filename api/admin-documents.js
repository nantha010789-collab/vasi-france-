export default async function handler(req,res){
 if(!['GET','PATCH'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 const url=process.env.VASI_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return res.status(503).json({error:'Supabase server configuration missing'});
 const auth=req.headers.authorization||'';if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Authentication required'});const token=auth.slice(7),h={apikey:key,Authorization:`Bearer ${key}`};
 const u=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});if(!u.ok)return res.status(401).json({error:'Invalid session'});const user=await u.json();
 const a=await fetch(`${url}/rest/v1/admin_allowlist?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,{headers:h});if(!a.ok||(await a.json()).length===0)return res.status(403).json({error:'Admin access required'});
 if(req.method==='GET'){const r=await fetch(`${url}/rest/v1/driver_documents?select=id,driver_id,document_type,file_path,status,rejection_reason,expires_at,reviewed_at,created_at&order=created_at.desc&limit=100`,{headers:h});if(!r.ok)return res.status(r.status).json({error:'Unable to load documents'});return res.status(200).json(await r.json())}
 let b={};try{b=typeof req.body==='string'?JSON.parse(req.body||'{}'):req.body||{}}catch{return res.status(400).json({error:'Invalid JSON body'})}
 const id=String(b.id||'').trim(),status=String(b.status||'').trim().toLowerCase();if(!id||id.length>120||!['approved','rejected'].includes(status))return res.status(400).json({error:'Document id and approved/rejected status required'});
 const existing=await fetch(`${url}/rest/v1/driver_documents?select=id,status,driver_id&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:h});if(!existing.ok)return res.status(existing.status).json({error:'Unable to verify document'});const docs=await existing.json();if(!docs.length)return res.status(404).json({error:'Document not found'});
 if(docs[0].status===status)return res.status(200).json(docs[0]);
 const reason=status==='rejected'?String(b.rejection_reason||'Rejected by administrator').trim().slice(0,500):null;
 const patch={status,reviewed_by:user.id,reviewed_at:new Date().toISOString(),rejection_reason:reason};
 const r=await fetch(`${url}/rest/v1/driver_documents?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{...h,'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(patch)});if(!r.ok)return res.status(r.status).json({error:'Unable to review document'});const updated=(await r.json())[0];if(!updated)return res.status(404).json({error:'Document not found'});return res.status(200).json(updated);
}
