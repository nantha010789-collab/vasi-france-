// Local-only browser regression. All authentication and database responses are
// synthetic fixtures. No production users, documents or approvals are created.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {join,resolve,extname} from "node:path";
import {createRequire} from "node:module";

const require=createRequire(import.meta.url);
let chromium;
try {({chromium}=require("playwright"));}
catch {({chromium}=createRequire(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,"package.json"))("playwright"));}
const root=process.cwd();
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,"http://local").pathname;
  const path=resolve(root,"."+pathname);
  if(!path.startsWith(root+"/")){res.writeHead(403).end();return;}
  try {
    const data=await readFile(path);
    const mime={".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".webp":"image/webp"};
    res.writeHead(200,{"Content-Type":mime[extname(path)]||"application/octet-stream"});res.end(data);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const base="http://127.0.0.1:"+server.address().port;
const browser=await chromium.launch({headless:true});
const docs=["identity","identity_back","vtc","licence","business","insurance","carte_grise","selfie"].map(document_type=>({document_type,file_path:"test-only/"+document_type,status:"approved"}));
try {
  for(const scenario of ["incomplete","pending","rejected","approved","error"]) {
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
    await context.addInitScript(({scenario,docs})=>{
      localStorage.setItem("vasi_driver_session_role","ride");
      window.__testScenario=scenario; window.__testDocs=docs;
    },{scenario,docs});
    await context.route("**/*",async route=>{
      const url=route.request().url();
      if(url.includes("@supabase/supabase-js")) {
        await route.fulfill({contentType:"text/javascript",body:`window.supabase={createClient(){
          const scenario=window.__testScenario;
          const driver=scenario==='incomplete'?null:{id:'test-only',user_id:'test-only',full_name:'Test Driver',verified:scenario==='approved',status:scenario==='rejected'?'rejected':scenario==='approved'?'approved':'pending'};
          return {auth:{getSession:async()=>({data:{session:{user:{id:'test-only'},access_token:'SYNTHETIC_ONLY'}}}),signOut:async()=>{}},
            rpc:async()=>({data:[],error:null}),
            from(table){const result={data:table==='drivers'?driver:table==='driver_documents'?window.__testDocs:[],error:scenario==='error'?{message:'test-only offline'}:null};
              return {select(){return this},eq(){return this},in(){return this},gte(){return this},order(){return this},limit(){return this},maybeSingle(){return Promise.resolve(result)},then(a,b){return Promise.resolve({...result,data:table==='drivers'?[driver]:result.data}).then(a,b)}}}
          };
        }};`});return;
      }
      if(url.includes("/api/")){await route.fulfill({json:{payouts_enabled:false,details_submitted:false}});return;}
      if(!url.startsWith(base)){await route.abort();return;}
      await route.continue();
    });
    const page=await context.newPage(),errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto(base+"/driver.html");
    if(scenario==='approved') {
      await page.waitForSelector('html[data-provider-approved="true"]');
      assert.equal(await page.locator("#toggle").isVisible(),true);
      assert.equal(await page.locator("#toggle").isDisabled(),true,"approval alone does not grant payout eligibility");
    } else {
      await page.waitForURL("**/driver-status.html?role=ride");
      const titles={incomplete:"Complétez votre inscription",pending:"Votre dossier est en cours de vérification",rejected:"Votre dossier nécessite une correction",error:"Impossible de vérifier votre dossier"};
      await page.waitForFunction(text=>document.getElementById('heading')?.textContent===text,titles[scenario]);
      assert.equal(await page.locator("#workspaceLink").isVisible(),false);
      if(scenario==='incomplete') assert.match(await page.locator("#progress").innerText(),/0\/8/);
      if(scenario==='pending') assert.equal(await page.locator("#registrationLink").isVisible(),false);
      if(scenario==='incomplete') await page.screenshot({path:"/tmp/vasi-driver-incomplete.png",fullPage:true});
      if(scenario==='pending') await page.screenshot({path:"/tmp/vasi-driver-pending.png",fullPage:true});
    }
    assert.deepEqual(errors,[],"unexpected browser errors: "+scenario);
    console.log("PASS mobile driver approval flow: "+scenario);
    await context.close();
  }
}finally{await browser.close();server.close();}
