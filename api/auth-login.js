const supabaseUrl = process.env.VASI_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VASI_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST required'});
  if(!supabaseUrl||!anonKey) return res.status(503).json({error:'Supabase environment is not configured'});
  const {email,password}=req.body||{};
  if(!email||!password) return res.status(400).json({error:'Email and password required'});
  const r=await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:anonKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const data=await r.json();
  if(!r.ok) return res.status(r.status).json({error:data?.msg||data?.error_description||data?.message||'Login failed'});
  return res.status(200).json({access_token:data.access_token,refresh_token:data.refresh_token,user:data.user});
}
