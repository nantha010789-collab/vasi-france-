export const STORAGE_KEY='vasi_test_drive_v1';
export const freshState=()=>({version:1,ride:'idle',food:'idle',restaurantApproved:false,restaurantOpen:false,events:[]});
const transitions={
 requestRide:['customer','ride','idle','requested','Le client demande une course.'],
 acceptRide:['driver','ride','requested','accepted','Le chauffeur accepte la course.'],
 arriveRide:['driver','ride','accepted','arrived','Le chauffeur arrive au départ.'],
 startRide:['driver','ride','arrived','in_progress','La course commence.'],
 finishRide:['driver','ride','in_progress','completed','La course est terminée (simulation).'],
 orderFood:['customer','food','idle','ordered','Le client commande chez VASI Food.'],
 acceptFood:['restaurant','food','ordered','accepted','Le restaurant accepte la commande.'],
 prepareFood:['restaurant','food','accepted','ready','La commande est prête.'],
 pickupFood:['courier','food','ready','picked_up','Le livreur récupère la commande.'],
 deliverFood:['courier','food','picked_up','delivered','La commande est livrée (simulation).'],
};
export function canAct(state,role,action){
 if(action==='approveRestaurant')return role==='admin'&&!state.restaurantApproved;
 if(action==='openRestaurant')return role==='restaurant'&&state.restaurantApproved&&!state.restaurantOpen;
 const t=transitions[action];
 return !!t&&t[0]===role&&state[t[1]]===t[2]&&(action!=='orderFood'||state.restaurantApproved&&state.restaurantOpen);
}
export function advance(state,role,action){
 if(!canAct(state,role,action))throw new Error('Cette étape n’est pas disponible pour ce rôle.');
 const next={...state,events:[...state.events]};
 if(action==='approveRestaurant'){next.restaurantApproved=true;next.events.push('L’admin approuve le restaurant fictif.');}
 else if(action==='openRestaurant'){next.restaurantOpen=true;next.events.push('Le restaurant fictif ouvre.');}
 else{const t=transitions[action];next[t[1]]=t[3];next.events.push(t[4]);}
 next.events=next.events.slice(-30);return next;
}
export function parseState(raw){
 try{const s=JSON.parse(raw);if(s?.version!==1||!['idle','requested','accepted','arrived','in_progress','completed'].includes(s.ride)||!['idle','ordered','accepted','ready','picked_up','delivered'].includes(s.food)||typeof s.restaurantApproved!=='boolean'||typeof s.restaurantOpen!=='boolean'||!Array.isArray(s.events)||!s.events.every(x=>typeof x==='string'))return freshState();return {...s,events:s.events.slice(-30)};}catch{return freshState();}
}
