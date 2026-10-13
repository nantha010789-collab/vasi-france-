/* Catalog metadata stays compatible with existing restaurant records. */
(function(root){
  const labels={restaurant:'Restaurant',grocery:'Épicerie',supermarket:'Supermarché'};
  const categories=['Fruits et légumes','Produits laitiers','Pain et pâtisserie','Viandes et poissons','Épicerie salée','Épicerie sucrée','Boissons','Surgelés','Hygiène et entretien'];
  const text=value=>String(value||'').trim();
  function type(cuisine){const value=text(cuisine);return /^Supermarché(?:\s*·|$)/i.test(value)?'supermarket':/^Épicerie(?:\s*·|$)/i.test(value)?'grocery':'restaurant'}
  function detail(cuisine){return type(cuisine)==='restaurant'?text(cuisine):text(cuisine).replace(/^(?:Épicerie|Supermarché)\s*(?:·\s*)?/i,'')}
  function cuisine(kind,value){const safe=labels[kind]?kind:'restaurant',d=text(value).slice(0,60);return safe==='restaurant'?d:labels[safe]+(d?' · '+d:'')}
  function splitDescription(value){const d=text(value),m=d.match(/^Format : ([^·]+)(?: · ([\s\S]*))?$/);return m?{unit:m[1].trim(),description:m[2]||''}:{unit:'',description:d}}
  function description(unit,value){const u=text(unit).replace(/·/g,' ').slice(0,40),d=text(value);return (u?'Format : '+u+(d?' · '+d:''):d).slice(0,300)}
  function readBasket(storage){
    const empty=()=>({restaurant_id:null,items:{}});
    try{
      const value=JSON.parse(storage.getItem('vasi_food_basket')||'null');
      if(!value||typeof value.restaurant_id!=='string'||!value.restaurant_id.trim()||!value.items||typeof value.items!=='object'||Array.isArray(value.items))return empty();
      const items={};
      for(const [id,quantity] of Object.entries(value.items)){
        if(id&&Number.isSafeInteger(quantity)&&quantity>0&&quantity<=10)items[id]=quantity;
      }
      return {restaurant_id:value.restaurant_id,items,...(typeof value.group_order_id==='string'?{group_order_id:value.group_order_id}:{})};
    }catch{return empty()}
  }
  root.VasiCommerce={labels,categories,type,detail,cuisine,splitDescription,description,readBasket};
})(globalThis);
