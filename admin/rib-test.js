(() => {
  const cfg=window.VASI_ADMIN_CONFIG,db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{storageKey:'vasi-admin-auth'}});
  const roles={driver:'Chauffeur VTC',courier:'Livreur',restaurant:'Restaurant / Market'},params=new URLSearchParams(location.search);
  const $=id=>document.getElementById(id);
  let busy=false;
  // Account IDs are identifiers only; no bank data or account links are stored.
  const account=role=>sessionStorage.getItem('vasi-rib-test-'+role)||'';
  if(roles[params.get('role')]&&/^acct_[A-Za-z0-9]+$/.test(params.get('account')||'')) sessionStorage.setItem('vasi-rib-test-'+params.get('role'),params.get('account'));
  $('roles').innerHTML=Object.entries(roles).map(([r,label])=>`<section><h2>${label}</h2><p class="status" id="status-${r}">Non commencé</p><button data-role="${r}" data-action="onboard" disabled>Connecter mon RIB TEST</button><button class="secondary" data-role="${r}" data-action="status" disabled>Actualiser</button></section>`).join('');
  const readinessButton=document.createElement('button');readinessButton.id='backendReadiness';readinessButton.className='secondary';readinessButton.textContent='Vérifier les comptes Stripe website / backend';readinessButton.disabled=true;$('enableConnect').after(readinessButton);
  async function api(role,action){
    const {data}=await db.auth.getSession();
    if(!data.session){$('login').hidden=false;throw Error('Connectez-vous avec votre compte administrateur.');}
    const a=account(role),query=new URLSearchParams({role,...(a?{account:a}:{})});
    const response=await fetch('/api/rib-onboarding-test'+(action==='status'?'?'+query:''),{method:action==='status'?'GET':'POST',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},...(action==='status'?{}:{body:JSON.stringify({action,role,account:a,request_id:crypto.randomUUID()})}),signal:AbortSignal.timeout(30000)});
    const r=await response.json();if(response.status===401||response.status===403)$('login').hidden=false;
    if(!response.ok)throw Error(r.error||'Test indisponible');if(r.test_mode!==true)throw Error('Mode TEST non confirmé');return r;
  }
  async function run(role,action){
    if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{const r=await api(role,action);if(action==='backend_readiness'){$('message').textContent='Website : '+(r.website_account_id||'non configuré')+'\nBackend : '+(r.account_id||'non configuré')+' · mode '+r.mode+'\nMême compte : '+(r.account_match?'oui':'NON')+' · Webhook backend configuré : '+(r.webhook_configured?'oui':'non');return;}if(action==='enable_connect'){$('message').textContent='Connect activé dans le sandbox TEST. Choisissez un partenaire ci-dessous.';return;}if(action==='onboard'){const u=new URL(r.url);if(!['https://connect.stripe.com','https://accounts.stripe.com'].includes(u.origin))throw Error('Adresse Stripe invalide');sessionStorage.setItem('vasi-rib-test-'+role,r.account);location.assign(u.href);return;}
      const labels={not_started:'Non commencé.',incomplete:'Formulaire à compléter.',pending:'Informations envoyées. Vérification Stripe en cours.',verified:'RIB ajouté et versements activés par Stripe.'};
      $('status-'+role).textContent=(labels[r.status]||r.status)+(r.account?'\nCompte fictif : '+r.account:'')+(r.account?'\nRIB ajouté : '+(r.bank_added?'oui':'non')+' · Versements activés : '+(r.payouts_enabled?'oui':'non'):'');$('message').textContent='Mode TEST confirmé. Aucun paiement lancé.';
    }catch(e){$('status-'+role).textContent=e.message;$('message').textContent=e.message;}
    finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  $('roles').addEventListener('click',e=>{const b=e.target.closest('button');if(b)run(b.dataset.role,b.dataset.action);});
  $('enableConnect').addEventListener('click',()=>run('driver','enable_connect'));
  readinessButton.addEventListener('click',()=>run('driver','backend_readiness'));
  (async()=>{for(const role of Object.keys(roles))await run(role,'status');})();
})();
