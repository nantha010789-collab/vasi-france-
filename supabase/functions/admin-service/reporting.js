// Calendar boundaries follow the operating timezone, including DST days.
const paris = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Paris', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' });
function parts(date) { return Object.fromEntries(paris.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)])); }
function midnight(year,month,day) {
  const target=Date.UTC(year,month-1,day); let guess=target;
  for(let i=0;i<3;i++){const p=parts(new Date(guess));guess+=target-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);}
  return new Date(guess).toISOString();
}
export function parisDayBounds(now=new Date()) {
  const p=parts(now), next=new Date(Date.UTC(p.year,p.month-1,p.day+1));
  return { start:midnight(p.year,p.month,p.day), end:midnight(next.getUTCFullYear(),next.getUTCMonth()+1,next.getUTCDate()), timeZone:'Europe/Paris' };
}
const euro = row => String(row.currency||'EUR').toUpperCase()==='EUR';
function sum(rows,key){return rows.reduce((c,row)=>c+Math.round((Number(row[key])||0)*100),0)/100;}
export function financialSummary(rides,payments){
  const completed=rides.filter(r=>r.status==='completed'&&euro(r));
  const successful=payments.filter(p=>['succeeded','paid'].includes(p.status)&&euro(p));
  return { todayGross:sum(completed,'final_fare'),todayCommission:sum(completed,'vasi_commission'),todayDriverAmount:sum(completed,'driver_amount'),todayPaymentsAmount:sum(successful,'amount') };
}
export async function readAllReportRows(makeQuery,pageSize=500){
  const rows=[];
  for(let offset=0;;offset+=pageSize){
    const {data,error}=await makeQuery().order('id',{ascending:true}).range(offset,offset+pageSize-1);
    if(error)throw error;
    rows.push(...(data||[]));
    if(!data||data.length<pageSize)return rows;
  }
}
