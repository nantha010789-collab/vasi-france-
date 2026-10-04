import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

function harness(extra = {}) {
  const redirects = [];
  const context = vm.createContext({ window: {}, location: {replace:url=>redirects.push(url)}, setTimeout, clearTimeout, ...extra });
  vm.runInContext(readFileSync("vasi-provider-access.js", "utf8"), context);
  return { access: context.window.VasiProviderAccess, redirects };
}
const profile = {id:"applicant", status:"approved", verified:true};
const documents = ["identity", "identity_back", "vtc", "licence", "business", "insurance", "carte_grise", "selfie"].map(document_type => ({document_type, file_path:"applicant/"+document_type, status:"approved"}));
function clientMock(driver, docs = documents, error = null) {
  const filters=[];
  return {
    filters,
    from(table) {
      const result={data:table==="driver_documents"?docs:driver,error};
      return {select(){return this},eq(column,value){filters.push([table,column,value]);return this},maybeSingle(){return Promise.resolve(result)},then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}};
    }
  };
}

test("a login with no application or documents remains incomplete", () => {
  const {access}=harness();
  const result=access.classify("ride",null,[]);
  assert.equal(result.state,"incomplete");
  assert.equal(result.present.length,0);
  assert.equal(result.approved.length,0);
  assert.equal(result.required.length,8);
});
test("submitted complete documents require BOTH server approval and verification", () => {
  const {access}=harness();
  for(const row of [{...profile,status:"pending"},{...profile,verified:false},{...profile,status:null}]) {
    assert.equal(access.classify("ride",row,documents).state,"pending");
  }
  assert.equal(access.classify("ride",profile,documents).state,"approved");
});
test("an approved driver with missing or unapproved documents remains blocked", () => {
  const {access}=harness();
  assert.equal(access.classify("ride",profile,documents.slice(1)).state,"incomplete");
  assert.equal(access.classify("ride",profile,documents.map(d=>({...d,status:"pending"}))).state,"pending");
  assert.equal(access.classify("ride",profile,documents.map(d=>({...d,file_path:null}))).state,"incomplete");
});
test("rejection, suspension or expired required documents require corrections", () => {
  const {access}=harness();
  assert.equal(access.classify("ride",{...profile,status:"rejected"},documents).state,"rejected");
  assert.equal(access.classify("ride",{...profile,status:"suspended"},documents).state,"rejected");
  assert.equal(access.classify("ride",profile,documents.map(d=>d.document_type==="identity"?{...d,status:"rejected"}:d)).state,"rejected");
  assert.equal(access.classify("ride",profile,documents.map(d=>d.document_type==="vtc"?{...d,expires_at:"2026-01-01"}:d),Date.parse("2026-10-05")).state,"rejected");
});
test("courier approval requires its vehicle-specific documents", () => {
  const {access}=harness();
  for(const vehicle_type of ["bike","ebike","scooter","moto","car"]) {
    const row={application_status:"approved",verified:true,vehicle_type};
    row.documents=Object.fromEntries(access.requiredDocuments("courier",row).map(type=>[type,"applicant/"+type]));
    assert.equal(access.classify("courier",row).state,"approved");
    assert.equal(access.classify("courier",{...row,application_status:"pending"}).state,"pending");
    delete row.documents.selfie;
    assert.equal(access.classify("courier",row).state,"incomplete");
  }
});
test("approval reads are explicitly scoped to the session owner and profile ID",async()=>{
  const {access}=harness();
  const client=clientMock({...profile,id:"driver-profile-id"});
  assert.equal((await access.read(client,"ride","session-user-id")).state,"approved");
  assert.deepEqual(client.filters,[["drivers","user_id","session-user-id"],["driver_documents","driver_id","driver-profile-id"]]);
});
test("metadata and local role claims cannot grant workspace access",async()=>{
  const {access,redirects}=harness();
  const session={user:{id:"applicant",user_metadata:{verified:true,status:"approved",vasi_partner_status:"approved"}}};
  assert.equal(await access.requireApproval(clientMock(null),"ride",session),null);
  assert.deepEqual(redirects,["driver-status.html?role=ride"]);
});
test("errors or unavailable database fail closed, never authorize access",async()=>{
  const {access,redirects}=harness();
  assert.equal(await access.requireApproval(clientMock(profile,documents,{message:"database unavailable"}),"ride",{user:{id:"applicant"}}),null);
  assert.equal(redirects.length,1);
});
test("database verification has a bounded timeout",async()=>{
  const {access}=harness({setTimeout:callback=>{queueMicrotask(callback);return 1},clearTimeout:()=>{}});
  const hung={from:()=>({select(){return this},eq(){return this},maybeSingle:()=>new Promise(()=>{})})};
  await assert.rejects(access.read(hung,"ride","applicant"),/Vérification indisponible/);
});
test("only server-approved complete dossiers open the workspace",async()=>{
  const {access,redirects}=harness();
  const result=await access.requireApproval(clientMock(profile),"ride",{user:{id:"applicant"}});
  assert.equal(result.state,"approved");
  assert.equal(redirects.length,0);
});
test("direct driver/courier URLs hide workspace before checking approval",()=>{
  for(const [page,role] of [["driver.html","ride"],["delivery-driver.html","courier"]]) {
    const source=readFileSync(page,"utf8");
    assert.ok(source.indexOf("html:not([data-provider-approved])")<source.indexOf("<body"));
    assert.match(source,new RegExp('requireApproval\\(client, "'+role+'",'));
    assert.ok(source.indexOf('if (!access) return;')<source.indexOf('providerApproved = true;'));
  }
});
test("registration and PWA entry use dossier status rather than login as approval",()=>{
  const auth=readFileSync("auth.html","utf8"),home=readFileSync("driver-home.html","utf8"),sw=readFileSync("sw.js","utf8");
  assert.match(auth,/savedRole === "ride"\) return "driver-status.html\?role=ride"/);
  assert.match(auth,/savedRole === "courier"\) return "driver-status.html\?role=courier"/);
  assert.match(home,/VasiProviderAccess\.read/);
  assert.match(home,/access.state === "approved"/);
  assert.match(sw,/appUrl\("driver-status.html"\)/);
  assert.match(sw,/appUrl\("vasi-provider-access.js"\)/);
});
