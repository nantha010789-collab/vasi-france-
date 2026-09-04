const supabaseUrl=process.env.VASI_SUPABASE_URL||process.env.SUPABASE_URL;const anonKey=process.env.VASI_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY;const stripeKey=process.env.STRIPE_SECRET_KEY;
async function sb(path,auth,opt={}){return fetch(`${supabaseUrl}${path}`,{...opt,headers:{apikey:anonKey,Authorization:auth,'Content-Type':'application/json',...(opt.headers||{})}})}
async function captureCancellation(ride,auth){const method=String(ride?.payment_method||'cash').toLowerCase();const fee=Number(ride?.cancellation_fee??ride?.final_fare??5);if(method==='cash')return {ok:true,status:'cash',amount:fee};if(!stripeKey)return {ok:false,error:'Payment service is not configured'};const pr=await sb(`/rest/v1/payments?select=*&ride_id=eq.${encodeURIComponent(ride.id)}&provider=eq.stripe&limit=1`,auth);const pays=await pr.json();if(!pr.ok||!pays?.length)return {ok:false,error:'Stripe payment not found'};const payment=pays[0],intent=payment.provider_payment_id;if(!intent)return {ok:false,error:'Stripe payment intent missing'};const ir=await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(intent)}`,{headers:{Authorization:`Bearer ${stripeKey}`}});const pi=await ir.json();if(!ir.ok)return {ok:false,error:pi?.error?.message||'Stripe lookup failed'};if(pi.status==='succeeded')return {ok:true,status:'succeeded',amount:Number(payment.amount||fee),already_captured:true};if(pi.status!=='requires_capture')return {ok:false,error:'Payment is not available for cancellation capture',payment_status:pi.status};const amount=Math.round(fee*100);if(amount>Number(pi.amount||0))return {ok:false,error:'Cancellation fee exceeds authorized amount'};const cr=await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(intent)}/capture`,{method:'POST',headers:{Authorization:`Bearer ${stripeKey}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({amount_to_capture:String(amount)}).toString()});const captured=await cr.json();if(!cr.ok)return {ok:false,error:captured?.error?.message||'Cancellation capture failed'};await sb(`/rest/v1/payments?id=eq.${encodeURIComponent(payment.id)}`,auth,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({amount:fee,status:captured.status==='succeeded'?'completed':'pending'})});return {ok:true,status:captured.status,amount:fee};}
export default async function handler(req,res){
 if(!['GET','DELETE'].includes(req.method))return res.status(405).json({error:'GET or DELETE required'});
 const auth=req.headers.authorization||'';
 if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Unauthorized'});
 if(!supabaseUrl||!anonKey)return res.status(500).json({error:'Supabase environment is not configured'});
 const id=String(req.query?.id||'');if(!id)return res.status(400).json({error:'Ride id required'});
 try{
  const rpc=req.method==='DELETE'?'vasi_customer_cancel_ride':'get_customer_ride_status';
  const r=await fetch(`${supabaseUrl}/rest/v1/rpc/${rpc}`,{method:'POST',headers:{apikey:anonKey,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({p_ride_id:id})});
  const data=await r.json();
  if(!r.ok)return res.status(r.status).json({error:data?.message||data?.error||(req.method==='DELETE'?'Could not cancel ride':'Could not load ride')});
  if(req.method==='DELETE'){
   const ride=data?.ride||null;
   let payment={ok:true,status:'not_required'};
   if(ride)try{payment=await captureCancellation(ride,auth)}catch(e){payment={ok:false,error:e?.message||'Cancellation payment needs review'}}
   return res.status(200).json({...data,payment});
  }
  const ride=data?.ride||{};const driver=data?.driver||null;const location=data?.location||null;const safety=data?.safety||null;
  return res.status(200).json({...ride,driver_name:driver?.full_name||null,driver_rating:driver?.rating??null,driver_vehicle_make:driver?.vehicle_make||null,driver_vehicle_model:driver?.vehicle_model||null,driver_vehicle_plate:driver?.vehicle_plate||null,driver_vehicle_color:driver?.vehicle_color||null,driver_lat:location?.latitude??null,driver_lng:location?.longitude??null,driver_location_updated_at:location?.updated_at||null,pin_required:Boolean(safety?.pin_required),ride_pin:safety?.ride_pin||null,pin_verified_at:safety?.pin_verified_at||null,share_token:safety?.share_token||null,sharing_enabled:Boolean(safety?.sharing_enabled),share_expires_at:safety?.share_expires_at||null});
 }catch(e){return res.status(500).json({error:e?.message||'Server error'})}
}
