export default function handler(req,res){
  res.setHeader('Cache-Control','public, max-age=300');
  const url=process.env.VASI_SUPABASE_URL||process.env.SUPABASE_URL||'';
  const key=process.env.VASI_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY||'';
  if(!url||!key)return res.status(503).json({error:'Client configuration unavailable'});
  return res.status(200).json({url,key});
}
