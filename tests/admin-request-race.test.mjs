import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

function harness({timeout=false,hungSession=false}={}) {
  const elements=new Map(), requests=[];
  function element(id) {
    if(!elements.has(id)) elements.set(id,{innerHTML:"",textContent:"",className:"",value:"",dataset:{},classList:{toggle(){}},setAttribute(){},addEventListener(){},appendChild(){}});
    return elements.get(id);
  }
  const document={getElementById:element,querySelectorAll:()=>[],createElement:()=>element(Math.random())};
  const db={auth:{getSession:()=>hungSession?new Promise(()=>{}):Promise.resolve({data:{session:{access_token:"TEST_ONLY"}}}),signOut:async()=>{}}};
  const window={supabase:{createClient:()=>db},removeEventListener(){},addEventListener(){}};
  const context=vm.createContext({window,document,AbortController,Intl,location:{replace(){}},setTimeout:(cb,ms)=>setTimeout(cb,timeout&&ms===12000?10:ms),clearTimeout,fetch:(path,{signal})=>new Promise((resolve,reject)=>{
    requests.push({path,resolve:body=>resolve({ok:true,status:200,json:async()=>body})});
    if(timeout) signal.addEventListener("abort",()=>reject(new Error("aborted")),{once:true});
  })});
  const source=readFileSync("admin/app.js","utf8").replace("  start();","  window.adminTest={render};");
  vm.runInContext(source,context);
  return {render:window.adminTest.render,requests,elements};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test("slow earlier admin requests cannot replace a newer tab",async()=>{
  const h=harness();
  const earlier=h.render("drivers");await flush();
  const current=h.render("bookings");await flush();
  h.requests.find(r=>r.path==="/api/admin-bookings").resolve([]);
  await current;
  assert.equal(h.elements.get("title").textContent,"Courses");
  h.requests.find(r=>r.path==="/api/admin-drivers").resolve([]);
  await earlier;
  assert.equal(h.elements.get("title").textContent,"Courses");
  assert.match(h.elements.get("app").innerHTML,/Gestion des courses/);
});
test("hanging admin data request becomes a visible retry error",async()=>{
  const h=harness({timeout:true});
  await h.render("drivers");
  assert.match(h.elements.get("app").innerHTML,/Données indisponibles/);
  assert.match(h.elements.get("app").innerHTML,/Réessayer/);
  assert.doesNotMatch(h.elements.get("app").innerHTML,/class="loading"/);
});
test("hanging session checks also stop the spinner with a retry error",async()=>{
  const h=harness({timeout:true,hungSession:true});
  await h.render("documents");
  assert.match(h.elements.get("app").innerHTML,/Le chargement a pris trop de temps/);
  assert.match(h.elements.get("app").innerHTML,/Réessayer/);
});
