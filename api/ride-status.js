const supabaseUrl=process.env.VASI_SUPABASE_URL||process.env.SUPABASE_URL;const anonKey=process.env.VASI_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY;
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'GET required'});
 const auth=req.headers.authorization||'';
 if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Unauthorized'});
 if(!supabaseUrl||!anonKey)return res.status(500).json({error:'Supabase environment is not configured'});
 const id=String(req.query?.id||'');if(!id)return res.status(400).json({error:'Ride id required'});
 try{
  const r=await fetch(`${supabaseUrl}/rest/v1/rpc/get_customer_ride_status`,{method:'POST',headers:{apikey:anonKey,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({p_ride_id:id})});
  const data=await r.json();
  if(!r.ok)return res.status(r.status).json({error:data?.message||data?.error||'Could not load ride'});
  const ride=data?.ride||{};const driver=data?.driver||null;const location=data?.location||null;
  const status=String(ride.status||'requested').toLowerCase()==='started'?'in_progress':ride.status;
  return res.status(200).json({...ride,status,driver_name:driver?.full_name||null,driver_rating:driver?.rating??null,driver_vehicle_make:driver?.vehicle_make||null,driver_vehicle_model:driver?.vehicle_model||null,driver_vehicle_plate:driver?.vehicle_plate||null,driver_vehicle_color:driver?.vehicle_color||null,driver_lat:location?.latitude??null,driver_lng:location?.longitude??null,driver_location_updated_at:location?.updated_at||null});
 }catch(e){return res.status(500).json({error:e?.message||'Server error'})}
}
