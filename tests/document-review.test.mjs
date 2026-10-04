import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {reviewChecks,reviewIssue,inspectFiles} from '../supabase/functions/admin-service/document-review.ts';
const checks=Object.fromEntries(reviewChecks.map(key=>[key,true]));
const note='Original and official source checked; holder details and selfie visually compared.';
test('same name alone never satisfies review evidence',()=>{
  assert.match(reviewIssue({details_match:true},note),/name alone/);
  assert.match(reviewIssue(checks,'OK'),/review note/);
  assert.equal(reviewIssue(checks,note),null);
});
for(const key of reviewChecks) test('manual review cannot omit '+key,()=>{
  assert.ok(reviewIssue({...checks,[key]:false},note));
  assert.ok(reviewIssue({...checks,[key]:'true'},note));
});
const jpeg=seed=>new Blob([new Uint8Array([255,216,255,seed,...Array(20).fill(seed)])],{type:'image/jpeg'});
function storage(blobs){return {storage:{from:()=>({download:async path=>({data:blobs[path],error:!blobs[path]})})}}}
test('server verifies actual bytes and rejects renamed unrelated formats',async()=>{
  await assert.rejects(inspectFiles(storage({'u/a':new Blob(['this is not an image but has a jpg filename'])}),'u',{identity:'u/a'}),/format/);
  await assert.rejects(inspectFiles(storage({'u/a':new Blob(['%PDF-1.7 example content'])}),'u',{identity:'u/a'}),/format/);
});
test('server denies other owners, unavailable objects and oversized or empty files',async()=>{
  await assert.rejects(inspectFiles(storage({}),'u',{identity:'other/a'}),/ownership/);
  await assert.rejects(inspectFiles(storage({}),'u',{identity:'u/a'}),/unavailable/);
  await assert.rejects(inspectFiles(storage({'u/a':new Blob([])}),'u',{identity:'u/a'}),/Empty/);
});
test('same bytes at different paths cannot pass as front and back',async()=>{
  await assert.rejects(inspectFiles(storage({'u/a':jpeg(1),'u/b':jpeg(1)}),'u',{identity:'u/a',identity_back:'u/b'}),/Identical/);
  const hashes=await inspectFiles(storage({'u/a':jpeg(1),'u/b':jpeg(2)}),'u',{identity:'u/a',identity_back:'u/b'});
  assert.equal(hashes.identity.length,64);assert.notEqual(hashes.identity,hashes.identity_back);
});
test('browser preflight also rejects renamed content and duplicate bytes',async()=>{
  const context=vm.createContext({window:{},crypto,Uint8Array});
  vm.runInContext(readFileSync('vasi-document-upload.js','utf8'),context);
  const validate=context.window.VasiDocumentUpload.validate;
  await assert.rejects(validate([['identity',new File(['fake image data'],'id.jpg',{type:'image/jpeg'})]]),/Format/);
  const a=new File([jpeg(1)],'a.jpg',{type:'image/jpeg'}),b=new File([jpeg(1)],'renamed.jpg',{type:'image/jpeg'});
  await assert.rejects(validate([['identity',a],['identity_back',b]]),/même fichier/);
});
test('registration requires both photos and does not label selected files approved',()=>{
  const html=readFileSync('partner-register-v2.html','utf8');
  assert.match(html,/id="identity_back"/);
  assert.match(html,/!selected\('identity'\) \|\| !selected\('identity_back'\)/);
  assert.match(html,/non validé/);assert.doesNotMatch(html,/content:'✓';width:20px/);
  assert.match(html,/await VasiDocumentUpload.validate/);
});
test('all approval endpoints bind evidence to a current document revision',()=>{
  const source=readFileSync('supabase/functions/admin-service/index.ts','utf8');
  assert.match(source,/expected_updated_at !== document.updated_at/);
  assert.match(source,/expected_documents/);
  assert.match(source,/reviewIssue\(body.checks/);
  assert.match(source,/inspectFiles\(db/);
  assert.match(source,/identity_back/);
  assert.match(readFileSync('supabase/functions/review-driver-document/index.ts','utf8'),/status:410/);
});
test('authenticated admin API rejects bare approval without writing',async()=>{
  let handler,writes=0;
  const row={id:'doc',driver_id:'u',document_type:'identity',file_path:'u/a',status:'pending',updated_at:'rev'};
  const db={from(table){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:table==='admin_allowlist'?{email:'admin@example.invalid'}:table==='drivers'?{full_name:'Synthetic applicant'}:row}),update(){writes++;return this},insert(){writes++;return this}}}};
  const context=vm.createContext({Response,Date,Set,Map,JSON,console,createClient:()=>({...db,auth:{getUser:async()=>({data:{user:{id:'admin',email:'admin@example.invalid'}}})}}),reviewIssue,inspectFiles,expiringDocuments:['identity','vtc','licence','insurance'],Deno:{env:{get:name=>name==='SUPABASE_URL'?'https://example.invalid':'configured-key'},serve:fn=>handler=fn}});
  const code=stripTypeScriptTypes(readFileSync('supabase/functions/admin-service/index.ts','utf8').replace(/^import .*;\n/gm,''));
  vm.runInContext(code,context);
  const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action:'review_document',id:'doc',status:'approved',expected_updated_at:'rev',expected_driver_name:'Synthetic applicant'})}));
  assert.equal(response.status,400);assert.match((await response.json()).error,/name alone/);assert.equal(writes,0);
  const stale=await handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action:'review_document',id:'doc',status:'approved',expected_updated_at:'old'})}));
  assert.equal(stale.status,409);assert.equal(writes,0);
});
