import {STORAGE_KEY,freshState,parseState,canAct,advance} from './test-drive-model.js';
const $=id=>document.getElementById(id);
let state=freshState(),scenario='ride',role='customer',persist=true;
try{state=parseState(localStorage.getItem(STORAGE_KEY));}catch{persist=false;}
const roles={customer:'Client',driver:'Chauffeur',restaurant:'Restaurant',courier:'Livreur',admin:'Admin'};
const rideStates=['idle','requested','accepted','arrived','in_progress','completed'];
const foodStates=['idle','ordered','accepted','ready','picked_up','delivered'];
const labels={idle:'À commencer',requested:'Recherche du chauffeur',accepted:'Accepté',arrived:'Au point de départ',in_progress:'Course en cours',completed:'Course terminée',ordered:'Commande envoyée',ready:'Prête à récupérer',picked_up:'Livraison en cours',delivered:'Livrée'};
const actionLabels={requestRide:'Demander la course fictive',acceptRide:'Accepter la course',arriveRide:'Confirmer mon arrivée',startRide:'Démarrer la course',finishRide:'Terminer la course',approveRestaurant:'Approuver le restaurant fictif',openRestaurant:'Ouvrir le restaurant fictif',orderFood:'Passer la commande fictive',acceptFood:'Accepter la commande',prepareFood:'Marquer la commande prête',pickupFood:'Confirmer la récupération',deliverFood:'Confirmer la livraison'};
const rideActions=['requestRide','acceptRide','arriveRide','startRide','finishRide'];
const foodActions=['approveRestaurant','openRestaurant','orderFood','acceptFood','prepareFood','pickupFood','deliverFood'];
function nextStep(){
 if(scenario==='ride')return {idle:['customer','Demandez votre course.'],requested:['driver','Le chauffeur doit accepter la course.'],accepted:['driver','Le chauffeur rejoint le départ.'],arrived:['driver','Démarrez après la prise en charge fictive.'],in_progress:['driver','Terminez la course pour vérifier le suivi client.'],completed:['admin','Consultez le résultat dans la vue admin.']}[state.ride];
 if(!state.restaurantApproved)return ['admin','Approuvez le restaurant fictif.'];
 if(!state.restaurantOpen)return ['restaurant','Ouvrez le restaurant avant la commande.'];
 return {idle:['customer','Passez une commande fictive.'],ordered:['restaurant','Acceptez la commande.'],accepted:['restaurant','Préparez la commande.'],ready:['courier','Récupérez la commande.'],picked_up:['courier','Confirmez la livraison.'],delivered:['admin','Consultez la commande terminée.']}[state.food];
}
function row(label,value){const el=document.createElement('div');el.className='row';const l=document.createElement('span'),v=document.createElement('b');l.textContent=label;v.textContent=value;el.append(l,v);return el;}
function render(message=''){
 document.querySelectorAll('[data-role]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.role===role)));
 document.querySelectorAll('[data-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scenario===scenario)));
 $('roleLabel').textContent='ESPACE '+roles[role].toUpperCase();$('roleTitle').textContent=role==='admin'?'Vue d’ensemble de l’essai':scenario==='ride'?'Votre course de démonstration':'Votre commande VASI Food';
 const phases=scenario==='ride'?rideStates:foodStates,status=state[scenario];$('progress').replaceChildren(...phases.map((x,i)=>{const e=document.createElement('span');e.className=i<=phases.indexOf(status)?'active':'';return e;}));
 const card=document.createElement('div');card.className='summary';const pill=document.createElement('p');pill.className='pill';pill.textContent=labels[status];const title=document.createElement('h3');title.textContent=scenario==='ride'?'VASI Go · TEST-001':'Le Comptoir Démo · FOOD-001';card.append(pill,title);
 if(scenario==='ride'){card.append(row('Départ fictif','Alfortville'),row('Destination fictive','Savigny-le-Temple'),row('Chauffeur fictif','Alex · VASI Go'),row('Prix fictif fixe','26,43 €'));}
 else{card.append(row('Panier fictif','Menu végétarien + boisson'),row('Restaurant',state.restaurantApproved?'Approuvé dans la démo':'En attente de l’admin démo'),row('Disponibilité',state.restaurantOpen?'Ouvert dans la démo':'Fermé dans la démo'),row('Prix fictif fixe','18,50 €'));}
 if(role==='admin'){card.append(row('Courses terminées',state.ride==='completed'?'1':'0'),row('Commandes livrées',state.food==='delivered'?'1':'0'));}
 card.append(row('Paiement','Simulation · aucun débit'));$('content').replaceChildren(card);
 const available=(scenario==='ride'?rideActions:foodActions).filter(a=>canAct(state,role,a));$('actions').replaceChildren(...available.map(action=>{const b=document.createElement('button');b.className='primary';b.textContent=actionLabels[action];b.onclick=()=>{state=advance(state,role,action);save();render('Étape enregistrée dans la démo.');};return b;}));
 const [nextRole,nextCopy]=nextStep();$('nextTitle').textContent=roles[nextRole];$('nextCopy').textContent=nextCopy;$('nextRole').textContent=nextRole===role?'Vous êtes dans le bon espace':'Passer côté '+roles[nextRole].toLowerCase();$('nextRole').disabled=nextRole===role;$('nextRole').onclick=()=>{role=nextRole;render();};
 $('events').replaceChildren(...(state.events.length?state.events.slice().reverse():['Votre essai est prêt. Choisissez un rôle pour commencer.']).map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
 $('notice').textContent=message||(!persist?'Stockage local indisponible : la démo fonctionne jusqu’au rechargement.':available.length?'Utilisez le bouton ci-dessus pour avancer.':'Le prochain geste est indiqué à côté, ou plus bas sur mobile.');
}
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{persist=false;}}
for(const b of document.querySelectorAll('[data-role]'))b.onclick=()=>{role=b.dataset.role;render();};
for(const b of document.querySelectorAll('[data-scenario]'))b.onclick=()=>{scenario=b.dataset.scenario;role='customer';render();};
$('reset').onclick=()=>{state=freshState();save();role='customer';render('Démo remise à zéro. Vos comptes et données VASI réels n’ont pas été modifiés.');};
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){state=parseState(e.newValue);render('La démo a été actualisée depuis un autre onglet.');}});
render();
