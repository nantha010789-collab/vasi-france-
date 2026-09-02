export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const url=process.env.VASI_SUPABASE_URL||process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(503).json({error:'Supabase server configuration missing'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Authentication required'});
  const token=auth.slice(7).trim();
  if(!token)return res.status(401).json({error:'Authentication required'});
  const serviceHeaders={apikey:key,Authorization:`Bearer ${key}`};
  try{
    const u=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});
    if(!u.ok)return res.status(401).json({error:'Invalid session'});
    const user=await u.json().catch(()=>null);
    if(!user?.id)return res.status(401).json({error:'Invalid session'});
    const a=await fetch(`${url}/rest/v1/admin_allowlist?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,{headers:serviceHeaders});
    const allowed=a.ok?await a.json().catch(()=>[]):[];
    if(!a.ok||!Array.isArray(allowed)||allowed.length===0)return res.status(403).json({error:'Admin access required'});

    const [driverResp,rideResp]=await Promise.all([
      fetch(`${url}/rest/v1/drivers?select=id,full_name,phone,online,verified,latitude,longitude,vehicle_make,vehicle_model,vehicle_plate,vehicle_color,rating,updated_at&order=online.desc,updated_at.desc&limit=200`,{headers:serviceHeaders}),
      fetch(`${url}/rest/v1/rides?select=id,driver_id,status,pickup_address,destination_address,pickup_lat,pickup_lng,destination_lat,destination_lng,requested_at,accepted_at&status=in.(requested,accepted,driver_arriving,in_progress)&order=requested_at.desc&limit=200`,{headers:serviceHeaders})
    ]);
    if(!driverResp.ok)return res.status(driverResp.status).json({error:'Unable to load driver locations'});
    if(!rideResp.ok)return res.status(rideResp.status).json({error:'Unable to load active rides'});
    const drivers=await driverResp.json().catch(()=>[]);
    const rides=await rideResp.json().catch(()=>[]);
    if(!Array.isArray(drivers)||!Array.isArray(rides))return res.status(502).json({error:'Invalid live operations response'});

    const byDriver=new Map();
    for(const ride of rides){if(ride?.driver_id&&!byDriver.has(ride.driver_id))byDriver.set(ride.driver_id,ride)}
    const now=Date.now();
    const result=drivers.map(d=>{
      const updated=d.updated_at?new Date(d.updated_at).getTime():NaN;
      const age=Number.isFinite(updated)?Math.max(0,Math.round((now-updated)/1000)):null;
      return {...d,location_age_seconds:age,stale:age===null||age>60,active_ride:byDriver.get(d.id)||null};
    });
    return res.status(200).json({updated_at:new Date().toISOString(),drivers:result,active_rides:rides});
  }catch(e){
    return res.status(500).json({error:e?.message||'Unable to load live operations'});
  }
}
