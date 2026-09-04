export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const url=process.env.VASI_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return res.status(503).json({error:'Supabase server configuration missing'});
 const auth=req.headers.authorization||'';if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Authentication required'});const token=auth.slice(7),h={apikey:key,Authorization:`Bearer ${key}`};
 const u=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});if(!u.ok)return res.status(401).json({error:'Invalid session'});const user=await u.json();
 const a=await fetch(`${url}/rest/v1/admin_allowlist?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,{headers:h});if(!a.ok||(await a.json()).length===0)return res.status(403).json({error:'Admin access required'});
 const now=Date.now();const r=await fetch(`${url}/rest/v1/drivers?select=id,full_name,phone,online,verified,latitude,longitude,vehicle_make,vehicle_model,vehicle_plate,vehicle_color,rating,updated_at&order=online.desc,updated_at.desc&limit=200`,{headers:h});if(!r.ok)return res.status(r.status).json({error:'Unable to load driver locations'});
 const drivers=await r.json();const active=await fetch(`${url}/rest/v1/rides?select=id,driver_id,status,pickup_address,destination_address,pickup_lat,pickup_lng,destination_lat,destination_lng,requested_at,accepted_at&status=in.(requested,accepted,driver_arriving,in_progress)&order=requested_at.desc&limit=200`,{headers:h});if(!active.ok)return res.status(active.status).json({error:'Unable to load active rides'});
 const rides=await active.json();const byDriver=new Map(rides.filter(x=>x.driver_id).map(x=>[x.driver_id,x]));
 const result=drivers.map(d=>{const age=d.updated_at?Math.max(0,Math.round((now-new Date(d.updated_at).getTime())/1000)):null;return {...d,location_age_seconds:age,stale:age===null||age>60,active_ride:byDriver.get(d.id)||null}});
 return res.status(200).json({updated_at:new Date().toISOString(),drivers:result,active_rides:rides});
}
