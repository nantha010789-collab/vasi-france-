const supabaseUrl=process.env.VASI_SUPABASE_URL||process.env.SUPABASE_URL||"https://vhfyvkrvysrooaqzcxsp.supabase.co";
const anonKey=process.env.VASI_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY||"sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT";
const allowedSurfaces=new Set(["public","customer","driver","courier","restaurant","admin"]);
const allowedTasks=new Set(["summary","next_steps","risk_check","support"]);
const publicRateLimit=globalThis.__vasiPublicAiRateLimit||(globalThis.__vasiPublicAiRateLimit=new Map());
const publicWindowMs=10*60*1000;
const publicLimit=12;

async function currentUser(auth){
  if(!String(auth||"").startsWith("Bearer ")) return null;
  const r=await fetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:anonKey,Authorization:auth}});
  if(!r.ok) return null;
  return r.json();
}
function cleanText(value,max=240){
  return String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);
}
function cleanContext(input){
  const out={};
  for(const [key,value] of Object.entries(input&&typeof input==="object"?input:{})){
    if(Object.keys(out).length>=20) break;
    const k=cleanText(key,48);
    if(!k||/password|token|secret|card|email|phone|address|name|plate|iban|rib/i.test(k)) continue;
    if(typeof value==="number"||typeof value==="boolean") out[k]=value;
    else if(typeof value==="string") out[k]=cleanText(value,160);
  }
  return out;
}
function publicRequestAllowed(req){
  const now=Date.now();
  const forwarded=String(req.headers?.["x-forwarded-for"]||"").split(",")[0].trim();
  const key=cleanText(forwarded||req.headers?.["x-real-ip"]||"unknown",80);
  const current=publicRateLimit.get(key);
  if(!current||now-current.startedAt>=publicWindowMs){
    publicRateLimit.set(key,{count:1,startedAt:now});
    return true;
  }
  if(current.count>=publicLimit) return false;
  current.count+=1;
  return true;
}
function fallback(surface,task,ctx){
  const notes=[];
  if(surface==="driver"){
    if(ctx.online===false) notes.push("Vous êtes hors ligne. Passez en ligne uniquement quand vos documents et votre RIB sont prêts.");
    if(Number(ctx.pending_documents||0)>0) notes.push("Vérifiez les documents en attente ou proches de l’expiration.");
    if(Number(ctx.month_trips||0)===0) notes.push("Aucune course terminée ce mois-ci n’est encore affichée.");
    if(Number(ctx.busy_zones||0)>0) notes.push("Consultez les zones de demande avant de vous déplacer.");
  }else if(surface==="courier"){
    if(ctx.payout_ready===false) notes.push("Finalisez la vérification du RIB avant de commencer les livraisons.");
    if(ctx.online===false) notes.push("Passez en ligne lorsque vous êtes prêt à accepter une livraison.");
    if(ctx.active_job===true) notes.push("Terminez la mission active avant d’en accepter une autre.");
  }else if(surface==="restaurant"){
    if(Number(ctx.active_orders||0)>0) notes.push("Traitez d’abord les commandes actives.");
    if(Number(ctx.menu_items||0)===0) notes.push("Ajoutez au moins un article au menu avant l’ouverture.");
    if(ctx.payout_ready===false) notes.push("Finalisez la vérification du RIB avant d’ouvrir le restaurant.");
  }else if(surface==="admin"){
    if(Number(ctx.pending_rides||0)>0) notes.push("Surveillez les courses en attente et l’offre de chauffeurs.");
    if(Number(ctx.pending_documents||0)>0) notes.push("Des documents partenaires attendent une vérification humaine.");
    if(Number(ctx.payout_blocked||0)>0) notes.push("Des comptes de versement nécessitent une vérification.");
  }else{
    notes.push("Je peux aider à expliquer une course, une commande, un paiement ou un problème de compte.");
  }
  notes.push("VASI AI donne des conseils uniquement. Les paiements, remboursements, suspensions, validations et suppressions nécessitent une action humaine.");
  return notes.slice(0,4).join(" ");
}
function outputText(data){
  return data?.output_text||data?.output?.flatMap(x=>x.content||[]).find(x=>x.type==="output_text")?.text||"";
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","private, no-store, max-age=0");
  res.setHeader("Vary","Authorization");
  if(req.method!=="POST") return res.status(405).json({error:"POST required"});
  const auth=req.headers?.authorization||"";
  const user=await currentUser(auth).catch(()=>null);
  const surface=allowedSurfaces.has(req.body?.surface)?req.body.surface:"customer";
  const task=allowedTasks.has(req.body?.task)?req.body.task:"summary";
  const publicSupport=!user?.id&&surface==="public"&&task==="support";
  if(!user?.id&&!publicSupport) return res.status(401).json({error:"Sign in required"});
  if(publicSupport&&!publicRequestAllowed(req)) return res.status(429).json({error:"Trop de demandes. Réessayez dans quelques minutes."});
  const context=cleanContext(req.body?.context);
  const question=cleanText(req.body?.question,500);
  if(task==="support"&&question.length<3) return res.status(400).json({error:"Question required"});
  const fallbackReply=fallback(surface,task,context);
  if(!process.env.OPENAI_API_KEY) return res.status(200).json({enabled:false,advisory:true,reply:fallbackReply});

  try{
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:process.env.OPENAI_ADVISOR_MODEL||process.env.OPENAI_SUPPORT_MODEL||"gpt-5-mini",
        instructions:`You are VASI AI Advisor for a France-first mobility, food delivery and courier platform. Surface: ${surface}. Give a short practical answer in French unless the user asks in another language. Use only the supplied aggregate context. Do not infer private facts. You are advisory only: never claim to approve, reject, suspend, refund, charge, pay out, delete, verify identity, or execute an account action. Never instruct the user to bypass safety, legal, payment or verification controls. For immediate danger in France/EU tell the user to call 112. When a payment, refund, fraud, safety, driver approval, restaurant approval, account suspension or deletion decision is involved, explicitly say human review is required.`,
        input:JSON.stringify({task,question,context}),
        max_output_tokens:260
      })
    });
    if(!response.ok) return res.status(200).json({enabled:false,advisory:true,reply:fallbackReply});
    const reply=cleanText(outputText(await response.json()),900);
    return res.status(200).json({enabled:true,advisory:true,reply:reply||fallbackReply});
  }catch(error){
    console.warn("[ai-advisor] fallback",error?.message);
    return res.status(200).json({enabled:false,advisory:true,reply:fallbackReply});
  }
}
