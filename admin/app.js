(() => {
  'use strict';
  const config = window.VASI_ADMIN_CONFIG || {};
  const db = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const app = document.getElementById('app'), nav = document.getElementById('nav'), title = document.getElementById('title');
  const connection = document.getElementById('connection');
  const sections = [
    ['overview','⌂','Vue d’ensemble'],['bookings','🚕','Courses'],['gps','📍','GPS en direct'],
    ['drivers','🚗','Chauffeurs'],['documents','📄','Documents'],['couriers','🛵','Coursiers'],['restaurants','🍽','Restaurants'],
    ['orders','🧾','Commandes'],['finance','€','Paiements'],['pricing','⚙','Tarifs'],['support','💬','Support'],['deletions','⌫','Suppressions'],['audit','🛡','Journal']
  ];
  let accessToken = '', active = 'overview', gpsTimer = null, map = null, mapTiles = null, mapResizeObserver = null, mapTileFailures = 0, mapRecoveryUsed = false, markers = {}, gpsFitted = false, courierStatus = 'pending', restaurantStatus = 'pending';
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money = value => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(value)||0);
  const fmt = value => value ? new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : '—';
  function notify(message){const toast=document.getElementById('toast');toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2800)}
  function setConnected(ok){connection.className=`connection ${ok?'ok':'bad'}`;connection.innerHTML=`<i></i>${ok?'Connecté':'Indisponible'}`}
  function badge(value){const v=String(value||'—'),low=v.toLowerCase();const cls=/approved|verified|completed|resolved|online|active/.test(low)?'ok':/rejected|cancelled|closed|urgent/.test(low)?'bad':'warn';return `<span class="badge ${cls}">${esc(v)}</span>`}
  function payout(provider){const ready=provider.stripe_details_submitted&&provider.stripe_payouts_enabled;return `<div class="${ready?'payout-ready':'payout-blocked'}">${ready?'✓ RIB vérifié':'! RIB à connecter'}</div><div class="cell-sub">Stripe ${provider.stripe_details_submitted?'complété':'incomplet'}</div>`}
  function metric(label,value,note='Données en direct'){return `<article class="metric"><div class="metric-label">${esc(label)}</div><div class="metric-value">${esc(value??'—')}</div><div class="metric-note">${esc(note)}</div></article>`}
  async function endAdminSession(){await db.auth.signOut({scope:'local'});window.VasiAccountRole?.clear();location.replace('../admin-login.html')}
  async function api(path,options={}){const response=await fetch(path,{...options,headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json',...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(response.status===401||response.status===403){await endAdminSession();throw new Error('Session administrateur expirée.')}if(!response.ok)throw new Error(data.error||`Erreur ${response.status}`);return data}
  function syncMapSize(){
    if(!map)return;
    requestAnimationFrame(()=>map?.invalidateSize({pan:false,debounceMoveend:true}));
  }
  function watchMapSize(container){
    mapResizeObserver?.disconnect();
    mapResizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(syncMapSize):null;
    mapResizeObserver?.observe(container);
    window.addEventListener('resize',syncMapSize,{passive:true});
    window.addEventListener('orientationchange',syncMapSize,{passive:true});
    window.visualViewport?.addEventListener('resize',syncMapSize,{passive:true});
    [0,180,600].forEach(delay=>setTimeout(syncMapSize,delay));
  }
  function stopGps(){
    if(gpsTimer)clearTimeout(gpsTimer);
    gpsTimer=null;
    mapResizeObserver?.disconnect();
    mapResizeObserver=null;
    window.removeEventListener('resize',syncMapSize);
    window.removeEventListener('orientationchange',syncMapSize);
    window.visualViewport?.removeEventListener('resize',syncMapSize);
    if(map){map.remove();map=null}
    mapTiles=null;mapTileFailures=0;mapRecoveryUsed=false;markers={};gpsFitted=false;
  }
  function shell(name,content,actions=''){title.textContent=name;app.setAttribute('aria-busy','false');app.innerHTML=`${actions}<div id="content">${content}</div>`}
  function errorView(error){setConnected(false);return `<div class="error"><strong>Données indisponibles.</strong><br>${esc(error.message)}</div>`}
  async function overview(){try{const s=await api('/api/admin-stats');setConnected(true);shell('Vue d’ensemble',`<div class="summary-grid">${metric('Courses',s.bookings)}${metric('Courses actives',s.activeRides)}${metric('Chauffeurs en ligne',s.onlineDrivers)}${metric('Documents à vérifier',s.pendingDocuments)}${metric('Coursiers en attente',s.pendingCouriers)}${metric('Restaurants en attente',s.pendingRestaurants)}${metric('Clients',s.customers)}${metric('Chiffre brut aujourd’hui',money(s.todayGross))}</div><section class="panel"><div class="panel-head"><h2>Résumé financier</h2><button class="button" data-refresh>Actualiser</button></div><div class="summary-grid">${metric('Commission VASI',money(s.todayCommission),'Aujourd’hui')}${metric('Revenus chauffeurs',money(s.todayDriverAmount),'Aujourd’hui')}${metric('RIB chauffeurs prêts',s.payoutReadyDrivers,'Stripe vérifié')}${metric('RIB partenaires prêts',(s.payoutReadyCouriers||0)+(s.payoutReadyRestaurants||0),'Coursiers + restaurants')}</div></section>`)}catch(e){shell('Vue d’ensemble',errorView(e))}}
  function filters(statuses){return `<div class="filters"><input id="search" class="field search" type="search" placeholder="Rechercher…" aria-label="Rechercher"><select id="status" class="field"><option value="">Tous les statuts</option>${statuses.map(x=>`<option>${esc(x)}</option>`).join('')}</select><button class="button" data-refresh>Actualiser</button></div>`}
  function table(headers,rows){return rows.length?`<div class="table-wrap"><table><thead><tr>${headers.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:'<div class="empty">Aucune donnée pour le moment.</div>'}
  function bindFilter(){const search=document.getElementById('search'),status=document.getElementById('status');const run=()=>document.querySelectorAll('tbody tr').forEach(row=>row.hidden=!(row.textContent.toLowerCase().includes((search?.value||'').toLowerCase())&&(!status?.value||row.dataset.status===status.value)));search?.addEventListener('input',run);status?.addEventListener('change',run)}
  async function bookings(){try{const rows=await api('/api/admin-bookings');const html=table(['Client','Trajet','Prix','Statut','Chauffeur'],rows.map(b=>`<tr data-status="${esc(b.status)}"><td><div class="cell-main">${esc(b.customer_name||'Client')}</div><div class="cell-sub">${esc(b.customer_phone||'')}</div></td><td><div class="cell-main">${esc(b.pickup||'—')}</div><div class="cell-sub">→ ${esc(b.destination||'—')} · ${fmt(b.created_at)}</div></td><td>${money(b.estimated_price)}</td><td>${badge(b.status)}</td><td>${b.driver_id?'Affecté':'Non affecté'}</td></tr>`));shell('Courses',`<section class="panel"><div class="panel-head"><h2>Gestion des courses</h2></div>${filters(['pending','searching','accepted','in_progress','completed','cancelled'])}${html}</section>`);bindFilter()}catch(e){shell('Courses',errorView(e))}}
  async function drivers(){try{const rows=await api('/api/admin-drivers');const html=table(['Chauffeur','Véhicule','État','Vérification','Paiement','Actions'],rows.map(d=>`<tr data-status="${d.online?'online':'offline'}"><td><div class="cell-main">${esc(d.full_name||'Sans nom')}</div><div class="cell-sub">${esc(d.phone||'')}${d.rejection_reason?`<br><span class="danger-text">${esc(d.rejection_reason)}</span>`:''}</div></td><td>${esc(`${d.vehicle_make||''} ${d.vehicle_model||''}`)}<div class="cell-sub">${esc(d.vehicle_plate||'Sans immatriculation')}</div></td><td>${badge(d.online?'online':'offline')}</td><td>${badge(d.verified?'verified':d.status||'pending')}</td><td>${payout(d)}</td><td><div class="actions"><button class="button ${d.verified?'danger':''}" data-driver="${esc(d.id)}" data-driver-action="${d.verified?'suspend':'approve'}">${d.verified?'Suspendre':'Approuver'}</button>${d.online?`<button class="button" data-driver="${esc(d.id)}" data-driver-action="offline">Mettre hors ligne</button>`:''}</div></td></tr>`));shell('Chauffeurs',`<section class="panel"><div class="panel-head"><div><h2>Chauffeurs et véhicules</h2><p class="muted">L’administrateur peut approuver ou suspendre un chauffeur. Seul le chauffeur choisit de se mettre en ligne.</p></div></div>${filters(['online','offline'])}${html}</section>`);bindFilter();document.querySelectorAll('[data-driver]').forEach(btn=>btn.addEventListener('click',async()=>{const action=btn.dataset.driverAction;const reason=action==='suspend'?(prompt('Motif de la suspension :','Document expiré ou non conforme')||'Suspension administrateur'):null;if(!confirm(`Confirmer : ${action==='approve'?'approuver':action==='suspend'?'suspendre':'mettre hors ligne'} ce chauffeur ?`))return;try{const patch=action==='offline'?{id:btn.dataset.driver,online:false}:{id:btn.dataset.driver,verified:action==='approve',reason};await api('/api/admin-drivers',{method:'PATCH',body:JSON.stringify(patch)});notify('Chauffeur mis à jour');drivers()}catch(error){notify(error.message)}}))}catch(e){shell('Chauffeurs',errorView(e))}}
  async function documents(){try{const rows=await api('/api/admin-documents');const html=table(['Document','Chauffeur','Expiration','Statut','Actions'],rows.map(d=>`<tr data-status="${esc(d.status)}"><td><div class="cell-main">${esc(d.document_type||'Document')}</div><div class="cell-sub">${d.file_url?`<a href="${esc(d.file_url)}" target="_blank" rel="noopener noreferrer">Voir le document</a>`:'Fichier indisponible'}</div></td><td>${esc(d.driver_name||d.driver_id)}</td><td>${fmt(d.expires_at)}</td><td>${badge(d.status)}${d.rejection_reason?`<div class="cell-sub danger-text">${esc(d.rejection_reason)}</div>`:''}</td><td>${d.status==='pending'?`<div class="actions"><button class="button" data-doc="${esc(d.id)}" data-decision="approved">Approuver</button><button class="button danger" data-doc="${esc(d.id)}" data-decision="rejected">Refuser</button></div>`:'—'}</td></tr>`));shell('Documents',`<section class="panel"><div class="panel-head"><div><h2>Vérification des documents</h2><p class="muted">Ouvrez chaque document avant de prendre une décision. Les liens sécurisés expirent automatiquement.</p></div></div>${filters(['pending','approved','rejected'])}${html}</section>`);bindFilter();document.querySelectorAll('[data-doc]').forEach(btn=>btn.addEventListener('click',async()=>{const rejected=btn.dataset.decision==='rejected',reason=rejected?prompt('Motif du refus :','Document illisible ou invalide')||'Refus administrateur':null;if(!confirm(`Confirmer : ${rejected?'refuser':'approuver'} ce document ?`))return;await api('/api/admin-documents',{method:'PATCH',body:JSON.stringify({id:btn.dataset.doc,status:btn.dataset.decision,reason})});notify('Document mis à jour');documents()}))}catch(e){shell('Documents',errorView(e))}}
  function courierDocuments(courier){
    const links=courier.document_links||{},required=courier.required_documents||[];
    return `<div class="actions">${required.map(name=>links[name]
      ? `<a class="badge ok" href="${esc(links[name])}" target="_blank" rel="noopener noreferrer">✓ ${esc(name)}</a>`
      : `<span class="badge bad">✕ ${esc(name)}</span>`).join('')}</div>`;
  }
  async function couriers(){
    try{
      const selectedStatus=courierStatus;
      const data=await api(`/api/admin-partners?status=${encodeURIComponent(selectedStatus)}`),rows=data.partners||[];
      const html=table(['Coursier','Véhicule','Documents','Paiement','Créé','Actions'],rows.map(c=>`<tr data-status="${esc(c.application_status)}"><td><div class="cell-main">${esc(c.full_name||'Sans nom')}</div><div class="cell-sub">${esc(c.phone||'')}<br>${esc(c.address||'')}</div></td><td>${esc(c.vehicle_type||'—')}</td><td><div class="document-list">${courierDocuments(c)}</div></td><td>${payout(c)}</td><td>${fmt(c.created_at)}</td><td>${c.application_status==='pending'?`<div class="actions"><button class="button" data-courier="${esc(c.id)}" data-decision="approved">Approuver</button><button class="button danger" data-courier="${esc(c.id)}" data-decision="rejected">Refuser</button></div>`:badge(c.application_status)}</td></tr>`));
      shell('Coursiers',`<section class="panel"><div class="panel-head"><div><h2>Validation des coursiers</h2><p class="muted">Vérifiez l’identité et les documents requis. Après approbation, le coursier connecte lui-même son RIB sécurisé avec Stripe.</p></div><button class="button" data-refresh>Actualiser</button></div><div class="filters"><input id="search" class="field search" type="search" placeholder="Rechercher…" aria-label="Rechercher"><select id="status" class="field"><option value="pending" ${selectedStatus==='pending'?'selected':''}>En attente</option><option value="approved" ${selectedStatus==='approved'?'selected':''}>Approuvés</option><option value="rejected" ${selectedStatus==='rejected'?'selected':''}>Refusés</option></select></div>${html}</section>`);
      bindFilter();
      document.getElementById('status')?.addEventListener('change',event=>{courierStatus=event.target.value;couriers()});
      document.querySelectorAll('[data-courier]').forEach(btn=>btn.addEventListener('click',async()=>{
        const rejected=btn.dataset.decision==='rejected';
        const reason=rejected?prompt('Motif du refus :','Documents incomplets ou non conformes')||'Refus administrateur':null;
        if(!confirm(`Confirmer : ${rejected?'refuser':'approuver'} ce coursier ?`))return;
        btn.disabled=true;
        try{
          await api('/api/admin-partners',{method:'PATCH',body:JSON.stringify({id:btn.dataset.courier,status:btn.dataset.decision,reason})});
          notify('Coursier mis à jour');couriers();
        }catch(error){notify(error.message);btn.disabled=false}
      }));
    }catch(e){shell('Coursiers',errorView(e))}
  }
  async function restaurants(){
    try{
      const selectedStatus=restaurantStatus;
      const [restaurantData,photoData]=await Promise.all([
        api(`/api/restaurant-admin?status=${encodeURIComponent(selectedStatus)}`),
        api('/api/restaurant-admin?mode=photos&status=admin_review')
      ]);
      const rows=restaurantData.restaurants||[],photos=photoData.photos||[];
      const restaurantTable=table(['Restaurant','Contact','Livraison','Commission','Paiement','Créé','Actions'],rows.map(r=>`<tr data-status="${esc(r.status)}"><td><div class="cell-main">${esc(r.name||r.restaurant_name||'Restaurant')}</div><div class="cell-sub">${esc(r.address||'')}</div></td><td>${esc(r.email||r.owner_email||'—')}<div class="cell-sub">${esc(r.phone||'')}</div></td><td>${esc(r.delivery_mode||'—')}</td><td>${Number(r.commission_rate||.10)*100}%</td><td>${payout(r)}</td><td>${fmt(r.created_at)}</td><td>${r.status==='pending'?`<div class="actions"><button class="button" data-restaurant="${esc(r.id)}" data-decision="approved">Approuver</button><button class="button danger" data-restaurant="${esc(r.id)}" data-decision="rejected">Refuser</button></div>`:badge(r.status)}</td></tr>`));
      const photoTable=table(['Photo','Restaurant','Article','Contrôle IA','Actions'],photos.map(p=>`<tr data-status="${esc(p.photo_status)}"><td><img src="${esc(p.photo_candidate_url)}" alt="Photo de ${esc(p.name)}" style="width:96px;height:72px;object-fit:cover;border-radius:12px;border:1px solid #d8dee8"></td><td><div class="cell-main">${esc(p.restaurant?.name||'Restaurant')}</div><div class="cell-sub">${esc(p.restaurant?.email||'')}</div></td><td><div class="cell-main">${esc(p.name)}</div><div class="cell-sub">${esc(p.category||'Menu')}</div></td><td>${badge(p.photo_status)}<div class="cell-sub">${esc(p.photo_review_reason||'Vérification requise')}${p.photo_ai_confidence==null?'':` · ${Math.round(Number(p.photo_ai_confidence)*100)}%`}</div></td><td><div class="actions"><button class="button" data-photo="${esc(p.id)}" data-photo-decision="approved">Approuver</button><button class="button danger" data-photo="${esc(p.id)}" data-photo-decision="needs_changes">Demander une nouvelle photo</button></div></td></tr>`));
      shell('Restaurants',`<section class="panel"><div class="panel-head"><div><h2>Photos de menu à vérifier</h2><p class="muted">L’IA transmet ici les photos incertaines. La décision administrateur reste prioritaire.</p></div><button class="button" data-refresh>Actualiser</button></div>${photoTable}</section><section class="panel"><div class="panel-head"><h2>Demandes partenaires</h2></div><div class="tabs"><button class="button ${selectedStatus==='pending'?'active':''}" data-restaurant-status="pending">En attente</button><button class="button ${selectedStatus==='approved'?'active':''}" data-restaurant-status="approved">Approuvés</button><button class="button ${selectedStatus==='rejected'?'active':''}" data-restaurant-status="rejected">Refusés</button></div>${restaurantTable}</section>`);
      document.querySelectorAll('[data-restaurant-status]').forEach(btn=>btn.addEventListener('click',()=>{restaurantStatus=btn.dataset.restaurantStatus;restaurants()}));
      document.querySelectorAll('[data-restaurant]').forEach(btn=>btn.addEventListener('click',async()=>{
        const rejected=btn.dataset.decision==='rejected',reason=rejected?prompt('Motif du refus :','Informations à compléter')||'Refus administrateur':null;
        if(!confirm(`Confirmer : ${rejected?'refuser':'approuver'} ce restaurant ?`))return;
        await api('/api/restaurant-admin',{method:'PATCH',body:JSON.stringify({id:btn.dataset.restaurant,status:btn.dataset.decision,reason,commission_rate:.10})});
        notify('Restaurant mis à jour');restaurants();
      }));
      document.querySelectorAll('[data-photo]').forEach(btn=>btn.addEventListener('click',async()=>{
        const rejected=btn.dataset.photoDecision==='needs_changes';
        const reason=rejected?prompt('Correction demandée :','Ajoutez une photo nette du plat, sans texte ni filigrane.')||'Ajoutez une nouvelle photo du plat.':'Approved by VASI.';
        if(!confirm(`Confirmer : ${rejected?'demander une nouvelle photo':'approuver cette photo'} ?`))return;
        await api('/api/restaurant-admin',{method:'PATCH',body:JSON.stringify({photo_id:btn.dataset.photo,status:btn.dataset.photoDecision,reason})});
        notify('Photo de menu mise à jour');restaurants();
      }));
    }catch(e){shell('Restaurants',errorView(e))}
  }
  async function orders(){try{const data=await api('/api/admin-orders');const eats=table(['Commande','Restaurant','Client','Total','Paiement','Livraison','Versements'],(data.eats_orders||[]).map(o=>`<tr data-status="${esc(o.status)}"><td><div class="cell-main mono">#${esc(o.id.slice(0,8).toUpperCase())}</div><div class="cell-sub">${fmt(o.created_at)}</div></td><td>${esc(o.restaurant_name||'Restaurant')}</td><td><div class="cell-sub">${esc(o.delivery_address||'—')}</div></td><td>${money(o.total)}</td><td>${badge(o.payment_status)}</td><td>${badge(o.status)}</td><td><div>Restaurant: ${badge(o.restaurant_payout_status||'pending')}</div><div class="cell-sub">Coursier: ${esc(o.courier_payout_status||'pending')}</div></td></tr>`));const deliveries=table(['Livraison','Trajet','Prix','Statut','Coursier'],(data.delivery_orders||[]).map(o=>`<tr data-status="${esc(o.status)}"><td><div class="cell-main">${esc(o.item_type||'Colis')}</div><div class="cell-sub mono">#${esc(o.id.slice(0,8).toUpperCase())} · ${fmt(o.created_at)}</div></td><td><div class="cell-main">${esc(o.pickup_address||'—')}</div><div class="cell-sub">→ ${esc(o.dropoff_address||'—')}</div></td><td>${money(o.quote)}</td><td>${badge(o.status)}</td><td>${o.delivery_driver_id||o.driver_id?'Affecté':'Non affecté'}</td></tr>`));shell('Commandes',`<section class="panel"><div class="panel-head"><h2>Commandes VASI Eats</h2><button class="button" data-refresh>Actualiser</button></div>${filters(['pending','accepted','preparing','ready','picked_up','delivered','cancelled'])}${eats}</section><section class="panel"><div class="panel-head"><h2>Livraisons de colis</h2></div>${deliveries}</section>`);bindFilter()}catch(e){shell('Commandes',errorView(e))}}
  async function finance(){try{const data=await api('/api/admin-finance');const providers=[...(data.drivers||[]).map(x=>({...x,kind:'Chauffeur',name:x.full_name,state:x.status})),...(data.couriers||[]).map(x=>({...x,kind:'Coursier',name:x.full_name,state:x.application_status})),...(data.restaurants||[]).map(x=>({...x,kind:'Restaurant',state:x.status}))];const providerTable=table(['Partenaire','Type','Approbation','RIB / Stripe','Dette espèces'],providers.map(p=>`<tr data-status="${p.stripe_payouts_enabled?'ready':'blocked'}"><td><div class="cell-main">${esc(p.name||'Sans nom')}</div><div class="cell-sub">${esc(p.phone||p.email||'')}</div></td><td>${esc(p.kind)}</td><td>${badge(p.state)}</td><td>${payout(p)}</td><td>${p.kind==='Chauffeur'?money(p.cash_commission_debt||0):'—'}</td></tr>`));const payoutRows=table(['Versement','Chauffeur','Montant','Statut','Erreur','Date'],(data.driver_payouts||[]).map(p=>`<tr data-status="${esc(p.status)}"><td class="mono">#${esc(p.id.slice(0,8).toUpperCase())}</td><td class="mono">${esc(String(p.driver_id).slice(0,8))}</td><td>${money(p.amount)}</td><td>${badge(p.status)}</td><td><div class="cell-sub">${esc(p.failure_reason||'—')}</div></td><td>${fmt(p.processed_at||p.requested_at)}</td></tr>`));shell('Paiements',`<div class="summary-grid">${metric('Partenaires',providers.length)}${metric('RIB prêts',providers.filter(p=>p.stripe_payouts_enabled).length)}${metric('RIB à connecter',providers.filter(p=>!p.stripe_payouts_enabled).length)}${metric('Dette commission espèces',money((data.drivers||[]).reduce((n,d)=>n+Number(d.cash_commission_debt||0),0)))}</div><section class="panel"><div class="panel-head"><div><h2>Préparation des versements</h2><p class="muted">Le partenaire connecte son propre RIB. VASI ne stocke jamais l’IBAN complet.</p></div><button class="button" data-refresh>Actualiser</button></div>${providerTable}</section><section class="panel"><div class="panel-head"><h2>Historique des versements chauffeurs</h2></div>${payoutRows}</section>`)}catch(e){shell('Paiements',errorView(e))}}
  async function audit(){try{const data=await api('/api/admin-audit');const html=table(['Date','Action','Cible','Administrateur','Détails'],(data.events||[]).map(e=>`<tr><td>${fmt(e.created_at)}</td><td>${badge(e.action)}</td><td>${esc(e.target_type||'—')}<div class="cell-sub mono">${esc(e.target_id||'')}</div></td><td class="mono">${esc(String(e.admin_id||'').slice(0,8))}</td><td><div class="cell-sub mono">${esc(JSON.stringify(e.details||{}))}</div></td></tr>`));shell('Journal',`<section class="panel"><div class="panel-head"><div><h2>Journal d’administration</h2><p class="muted">Traçabilité des validations, refus et changements sensibles.</p></div><button class="button" data-refresh>Actualiser</button></div>${html}</section>`)}catch(e){shell('Journal',errorView(e))}}
  async function pricing(){try{const p=await api('/api/pricing');const cards=Object.entries(p.classes||{}).map(([name,v])=>metric(name.toUpperCase(),`${money(v.base)} + ${money(v.km)}/km`,`Minimum ${money(v.minFare)} · ${money(v.min)}/min`)).join('');shell('Tarifs & offres',`<div class="summary-grid">${cards}</div><section class="panel"><div class="panel-head"><div><h2>${esc(p.offer_name||'Offre VASI')}</h2><p class="muted">${p.offer_active?'Offre active':'Offre inactive'} · remise ${esc(p.discount_percent||0)} %</p></div><div class="actions"><a class="button" href="../admin-discounts.html">Gérer les codes promo</a><a class="button primary" href="../pricing-admin.html">Modifier les tarifs</a></div></div></section>`)}catch(e){shell('Tarifs & offres',errorView(e))}}
  async function support(){try{const data=await api('/api/support?admin=1'),rows=data.tickets||[];const html=table(['Ticket','Compte','Message','Priorité','Statut','Action'],rows.map(t=>`<tr data-status="${esc(t.status)}"><td><div class="cell-main">${esc(t.subject||t.category||'Support')}</div><div class="cell-sub">${fmt(t.created_at)}</div></td><td>${esc(t.user_role||'client')}</td><td><div class="cell-sub">${esc(t.description||'')}</div></td><td>${badge(t.priority)}</td><td>${badge(t.status)}</td><td><button class="button" data-ticket="${esc(t.id)}">Répondre</button></td></tr>`));shell('Support',`<section class="panel"><div class="panel-head"><h2>Tickets clients et partenaires</h2></div>${filters(['open','waiting_human','in_progress','resolved','closed'])}${html}</section>`);bindFilter();document.querySelectorAll('[data-ticket]').forEach(btn=>btn.addEventListener('click',async()=>{const reply=prompt('Réponse VASI :');if(!reply?.trim())return;await api('/api/support',{method:'PATCH',body:JSON.stringify({id:btn.dataset.ticket,status:'resolved',human_reply:reply.trim()})});notify('Réponse enregistrée');support()}))}catch(e){shell('Support',errorView(e))}}
  async function deletions(){try{const data=await api('/api/admin-deletions'),rows=data.requests||[];const html=table(['Demande','Compte','Motif','Échéance','Statut','Actions'],rows.map(r=>`<tr data-status="${esc(r.status)}"><td><div class="cell-main mono">#${esc(r.id.slice(0,8).toUpperCase())}</div><div class="cell-sub">${fmt(r.requested_at)}</div></td><td class="mono">${esc(String(r.user_id).slice(0,8))}</td><td><div class="cell-sub">${esc(r.reason||'Aucun motif')}</div></td><td>${fmt(r.scheduled_for)}</td><td>${badge(r.status)}</td><td>${['requested','processing'].includes(r.status)?`<div class="actions"><button class="button" data-deletion="${esc(r.id)}" data-deletion-status="processing">Traiter</button><button class="button danger" data-deletion="${esc(r.id)}" data-deletion-status="rejected">Refuser</button><button class="button" data-deletion="${esc(r.id)}" data-deletion-status="cancelled">Annuler</button></div>`:'—'}</td></tr>`));shell('Suppressions',`<section class="panel"><div class="panel-head"><div><h2>Demandes de suppression</h2><p class="muted">Vérifiez les courses, paiements et obligations légales avant toute suppression. La clôture définitive exige la procédure serveur sécurisée.</p></div><button class="button" data-refresh>Actualiser</button></div>${filters(['requested','processing','cancelled','rejected','completed'])}${html}</section>`);bindFilter();document.querySelectorAll('[data-deletion]').forEach(btn=>btn.addEventListener('click',async()=>{const note=prompt('Note interne :','Vérification administrateur')||'';if(!confirm('Confirmer la mise à jour de cette demande ?'))return;await api('/api/admin-deletions',{method:'PATCH',body:JSON.stringify({id:btn.dataset.deletion,status:btn.dataset.deletionStatus,admin_note:note})});notify('Demande mise à jour');deletions()}))}catch(e){shell('Suppressions',errorView(e))}}
  async function gps(){
    if(!map){
      shell('GPS en direct',`<section class="panel gps-panel"><div class="panel-head"><div><h2>Chauffeurs en direct</h2><p id="gpsStatus" class="muted" role="status">Chargement des positions…</p></div><button class="button" data-refresh>Actualiser</button></div><div class="gps-map-shell"><div id="gpsMap" class="gps-map" aria-label="Carte interactive des chauffeurs en direct"></div><div id="gpsMapLoading" class="gps-map-loading" role="status"><span class="gps-spinner" aria-hidden="true"></span>Chargement de la carte…</div><div id="gpsMapNotice" class="gps-map-notice" role="status" hidden></div><div class="gps-map-legend" aria-label="Légende de la carte"><span><i class="gps-dot live"></i>Position récente</span><span><i class="gps-dot stale"></i>À actualiser</span></div></div></section>`);
      if(!window.L){shell('GPS en direct',errorView(new Error('La carte ne peut pas être chargée. Vérifiez la connexion internet.')));return}
      const mapElement=document.getElementById('gpsMap');
      map=window.L.map(mapElement,{zoomControl:true,zoomAnimation:true,fadeAnimation:true,trackResize:true}).setView([48.8566,2.3522],9);
      mapTiles=window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,updateWhenIdle:false,updateWhenZooming:true,keepBuffer:3,attribution:'© OpenStreetMap contributors'}).addTo(map);
      mapTiles.on('load',()=>{document.getElementById('gpsMapLoading')?.classList.add('hidden');mapTileFailures=0});
      mapTiles.on('tileerror',()=>{
        mapTileFailures+=1;
        if(mapTileFailures>=3&&!mapRecoveryUsed){
          mapRecoveryUsed=true;
          setTimeout(()=>{if(map&&mapTiles){mapTileFailures=0;mapTiles.redraw();syncMapSize()}},900);
        }else if(mapTileFailures>=6){
          const notice=document.getElementById('gpsMapNotice');
          if(notice){notice.hidden=false;notice.textContent='Le fond de carte se recharge. Vérifiez votre connexion si des zones restent vides.'}
        }
      });
      map.whenReady(()=>{syncMapSize();document.getElementById('gpsMapLoading')?.classList.add('hidden')});
      watchMapSize(mapElement);
    }
    const status=document.getElementById('gpsStatus');
    try{
      const data=await api('/api/admin-live-gps');
      setConnected(true);
      const visible=new Set(),bounds=[];
      (data.drivers||[]).forEach(d=>{
        const latitude=Number(d.latitude),longitude=Number(d.longitude);
        if(!d.online||!d.verified||!Number.isFinite(latitude)||!Number.isFinite(longitude))return;
        const point=[latitude,longitude],age=d.location_age_seconds==null?'Position ancienne':d.location_age_seconds<60?'À l’instant':`Il y a ${Math.round(d.location_age_seconds/60)} min`;
        const popup=`<strong>${esc(d.full_name||'Chauffeur')}</strong><br>${esc(d.vehicle_plate||'')}<br>${esc(d.online?'En ligne':'Hors ligne')} · ${esc(age)}`;
        visible.add(d.id);bounds.push(point);
        const stale=d.stale===true||Number(d.location_age_seconds)>60;
        if(markers[d.id])markers[d.id].setLatLng(point).setStyle({fillColor:stale?'#f59e0b':'#2563eb'}).setPopupContent(popup);
        else markers[d.id]=window.L.circleMarker(point,{radius:9,weight:3,color:'#fff',fillColor:stale?'#f59e0b':'#2563eb',fillOpacity:1,className:'gps-driver-marker'}).addTo(map).bindPopup(popup);
      });
      Object.keys(markers).forEach(id=>{if(!visible.has(id)){markers[id].remove();delete markers[id]}});
      if(bounds.length&&!gpsFitted){map.fitBounds(bounds,{padding:[34,34],maxZoom:15});gpsFitted=true}
      syncMapSize();
      if(status)status.textContent=bounds.length?`${bounds.length} chauffeur${bounds.length>1?'s':''} en ligne · Actualisé à ${new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(data.updated_at||Date.now()))}`:'Aucun chauffeur vérifié en ligne. La carte est prête et les positions apparaîtront automatiquement.';
    }catch(e){
      setConnected(false);
      if(status)status.textContent='Positions temporairement indisponibles. Nouvelle tentative automatique…';
    }finally{
      if(gpsTimer)clearTimeout(gpsTimer);
      gpsTimer=setTimeout(()=>active==='gps'&&gps(),15000);
    }
  }
  const loaders={overview,bookings,gps,drivers,documents,couriers,restaurants,orders,finance,pricing,support,deletions,audit};
  async function render(id){stopGps();active=id;document.querySelectorAll('.nav-button').forEach(x=>x.classList.toggle('active',x.dataset.section===id));app.setAttribute('aria-busy','true');app.innerHTML='<div class="loading">Chargement…</div>';await loaders[id]();document.querySelectorAll('[data-refresh]').forEach(btn=>btn.addEventListener('click',()=>render(active)))}
  sections.forEach(([id,icon,label])=>{const button=document.createElement('button');button.type='button';button.className='nav-button';button.dataset.section=id;button.innerHTML=`<span class="nav-icon">${icon}</span><span>${label}</span>`;button.addEventListener('click',()=>render(id));nav.appendChild(button)});
  document.getElementById('logout').addEventListener('click',endAdminSession);
  const language=document.getElementById('adminLanguage');language.value=['fr','en'].includes(window.VasiLanguage?.getLanguage?.())?window.VasiLanguage.getLanguage():'fr';language.addEventListener('change',()=>{window.VasiLanguage?.setLanguage(language.value);render(active)});
  async function start(){const {data}=await db.auth.getSession();if(!data.session){window.VasiAccountRole?.clear();return location.replace('../admin-login.html')}const activeRole=window.VasiAccountRole?.active();if(activeRole&&activeRole!=='admin')return location.replace('../'+window.VasiAccountRole.destination(activeRole));accessToken=data.session.access_token;try{const response=await fetch(`${config.supabaseUrl}/functions/v1/admin-service`,{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({action:'check_access'})});if(!response.ok)throw new Error('Accès refusé');window.VasiAccountRole?.remember('admin');setConnected(true);render('overview')}catch{await endAdminSession()}}
  start();
})();
