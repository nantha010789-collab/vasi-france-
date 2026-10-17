(() => {
  const $ = id => document.getElementById(id), cfg = window.VASI_ADMIN_CONFIG;
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {auth:{storageKey:'vasi-admin-auth'}});
  let busy = false;
  const params = new URLSearchParams(location.search), sessionId = params.get('setup_session');
  const money = n => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n);
  async function api(action) {
    const {data} = await db.auth.getSession();
    if (!data.session) { $('login').hidden=false; throw Error('Connectez-vous avec votre compte administrateur pour cet essai.'); }
    const response = await fetch('/api/cash-commission-test'+(action==='status'&&sessionId?'?session='+encodeURIComponent(sessionId):''),{
      method:action==='status'?'GET':'POST',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},
      ...(action==='status'?{}:{body:JSON.stringify({action,session:sessionId,request_id:crypto.randomUUID()})}),signal:AbortSignal.timeout(30000),
    });
    const result = await response.json();
    if (response.status===401||response.status===403) $('login').hidden=false;
    if (!response.ok) throw Error(result.error||'Service de test indisponible');
    if (result.test_mode!==true) throw Error('Mode de test non confirmé : opération bloquée.');
    return result;
  }
  function render(r) {
    $('remaining').textContent=money(r.remaining??12);
    const labels={ready:'Prêt : aucun mandat ni débit effectué.',mandate_required:'Mandat de test non terminé.',mandate_ready:'Mandat de test prêt.',processing:'Prélèvement SEPA fictif en cours. Solde non soldé.',succeeded:'Stripe a confirmé le paiement fictif.',requires_payment_method:'Le prélèvement fictif a échoué. La dette reste due.',canceled:'Prélèvement fictif annulé. La dette reste due.'};
    $('status').textContent=(labels[r.status]||r.status)+(r.payment_id?'\nRéférence test : '+r.payment_id:'');
    $('refresh').hidden=!sessionId;
    // Each completed test uses a separate Stripe customer and a fixed €12 fixture.
    $('setup').hidden=!!sessionId;
  }
  async function run(action) {
    if(busy)return;busy=true;$('setup').disabled=true;$('refresh').disabled=true;
    try{const r=await api(action);if(action==='setup'){const u=new URL(r.url);if(u.origin!=='https://checkout.stripe.com')throw Error('Adresse Stripe invalide');location.assign(u.href);return;}render(r);}
    catch(e){$('status').textContent=e.message;}
    finally{busy=false;$('refresh').disabled=false;}
  }
  $('setup').addEventListener('click',()=>run('setup'));
  $('refresh').addEventListener('click',()=>run('status'));
  (async()=>{try{const r=await api('status');render(r);if(sessionId){await run('collect');}else{$('setup').disabled=false;if(params.has('cancelled'))$('status').textContent='Formulaire de test annulé. Aucun débit lancé.';}}catch(e){$('status').textContent=e.message;}})();
})();
