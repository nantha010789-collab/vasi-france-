export default async function handler(req,res){
  res.setHeader('Cache-Control','public, max-age=300');
  let url=process.env.VASI_SUPABASE_URL||process.env.SUPABASE_URL||'';
  let key=process.env.VASI_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY||'';
  if(!url||!key){
    try{
      const host=req.headers['x-forwarded-host']||req.headers.host;
      const proto=req.headers['x-forwarded-proto']||'https';
      const source=await fetch(`${proto}://${host}/auth.html`,{headers:{'User-Agent':'VASI-config'}}).then(r=>r.text());
      url=url||(source.match(/https:\/\/[a-z0-9-]+\.supabase\.co/i)||[])[0]||'';
      key=key||(source.match(/sb_publishable_[A-Za-z0-9_-]+/)||[])[0]||'';
    }catch(_error){}
  }
  if(!url||!key)return res.status(503).json({error:'Client configuration unavailable'});
  return res.status(200).json({url,key});
}
