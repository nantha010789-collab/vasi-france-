export function commerceListOptions(input={}) {
  const page=Math.max(1,Math.min(100000,Math.floor(Number(input.page)||1)));
  const pageSize=25;
  const type=['restaurant','grocery','supermarket'].includes(input.store_type)?input.store_type:'all';
  const search=String(input.search||'').trim().replace(/[%_\\]/g,'').slice(0,80);
  return {page,pageSize,type,search,from:(page-1)*pageSize,to:page*pageSize-1};
}
export function catalogueCounts(items) {
  const counts=new Map();
  for(const item of items){const c=counts.get(item.restaurant_id)||{total:0,available:0};c.total++;if(item.active===true)c.available++;counts.set(item.restaurant_id,c);}
  return counts;
}
