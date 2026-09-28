const clampInt=(value,min,max)=>{
  const n=Number.parseInt(String(value??""),10);
  return Number.isFinite(n)?Math.min(max,Math.max(min,n)):null;
};

export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({error:"Method not allowed"});
  const z=clampInt(req.query.z,0,19), x=clampInt(req.query.x,0,1<<19), y=clampInt(req.query.y,0,1<<19);
  if(z===null||x===null||y===null) return res.status(400).json({error:"Invalid tile"});
  const limit=(1<<z)-1;
  if(x>limit||y>limit) return res.status(400).json({error:"Invalid tile"});
  const urls=[
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`
  ];
  for(const url of urls){
    try{
      const response=await fetch(url,{headers:{
        "User-Agent":"VASI/1.0 (map tile proxy; contact@vasigo.eu)",
        "Accept":"image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      }});
      if(!response.ok) continue;
      const buffer=Buffer.from(await response.arrayBuffer());
      res.setHeader("Content-Type",response.headers.get("content-type")||"image/png");
      res.setHeader("Cache-Control","public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000");
      res.setHeader("CDN-Cache-Control","public, max-age=604800");
      return res.status(200).send(buffer);
    }catch(_){}
  }
  res.setHeader("Cache-Control","no-store");
  return res.status(502).json({error:"Tile unavailable"});
}
