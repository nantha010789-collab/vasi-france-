import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(path,'utf8');
function dashboard(){
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id)){
      const classes=new Set();
      elements.set(id,{hidden:false,textContent:'',innerHTML:'',classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x),contains:x=>classes.has(x)}});
    }
    return elements.get(id);
  };
  const window={addEventListener(){}};
  const document={getElementById:element,addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null};
  vm.runInNewContext(read('vasi-driver-dashboard.js'),{window,document,Date,Number,setTimeout,clearTimeout,clearInterval,setInterval});
  return {window,element};
}
test('empty earnings never invent visible bars',()=>{
  const h=dashboard();h.window.renderEarningsChart([]);
  assert.equal(h.element('earningsChart').classList.contains('is-empty'),true);
  assert.match(h.element('earningsChart').innerHTML,/Aucun revenu/);
  assert.doesNotMatch(h.element('earningsChart').innerHTML,/earnings-bar/);
});
test('earnings ignores invalid rows and represents zero days as zero',()=>{
  const h=dashboard();h.window.renderEarningsChart([{created_at:'bad',driver_earnings:18},{created_at:new Date().toISOString(),driver_earnings:22}]);
  assert.equal(h.element('earningsChart').classList.contains('is-empty'),false);
  assert.match(h.element('earningsChart').innerHTML,/--bar-height:0\.0%/);
  assert.match(h.element('earningsChart').innerHTML,/22\.00/);
});
test('bank requirement explains disabled availability without removing the guard',()=>{
  const h=dashboard();h.window.syncDriverDashboardState({online:false,activeRide:null,payoutReady:false});
  assert.equal(h.element('onlineBlocker').hidden,false);
  assert.equal(h.element('onlineBlockerAction').hidden,false);
  assert.match(h.element('onlineBlockerText').textContent,/RIB/);
  assert.match(read('driver.html'),/disabled = !providerApproved \|\| !!activeRide \|\| \(!online && !payoutReady\)/);
});
test('active ride and ready bank states do not suggest inappropriate bank actions',()=>{
  const h=dashboard();h.window.syncDriverDashboardState({online:false,activeRide:{id:'test-only'},payoutReady:true});
  assert.equal(h.element('onlineBlockerAction').hidden,true);
  assert.match(h.element('onlineBlockerText').textContent,/Terminez/);
  h.window.syncDriverDashboardState({online:false,activeRide:null,payoutReady:true});
  assert.equal(h.element('onlineBlocker').hidden,true);
});
test('narrow driver navigation retains text labels and safe-area sizing',()=>{
  const css=read('vasi-driver-dashboard.css');
  assert.doesNotMatch(css,/\.driver-tab small\s*\{[^}]*display:\s*none/);
  assert.match(css,/100dvh - 228px/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(read('driver.html'),/home-secondary-details/);
  assert.doesNotMatch(read('driver.html'),/--hour-height:/);
});
test('all document inputs keep native selection behind bilingual styled controls',()=>{
  const html=read('partner-register-v2.html');
  const inputs=html.match(/class="file" type="file"/g)||[];
  const pickers=html.match(/class="file-picker"/g)||[];
  assert.equal(inputs.length,pickers.length);
  assert.ok(inputs.length>=14);
  assert.match(html,/data-en="Add a file">Ajouter un fichier/);
  assert.match(read('vasi-partner-mobile.css'),/\.file-picker:focus-within/);
  assert.match(read('sw.js'),/appUrl\("vasi-partner-mobile.css"\)/);
});
test('registration exposes one clear back control instead of duplicate buttons',()=>{
  const html=read('partner-register-v2.html');
  const navigation=read('vasi-navigation.js');
  assert.equal((html.match(/id="previousButton"/g)||[]).length,1);
  assert.doesNotMatch(html,/class="back-btn"/);
  assert.doesNotMatch(html,/function goBack\(/);
  assert.match(navigation,/"partner-register-v2\.html",/);
  assert.match(html,/function previousStep\(\)/);
  assert.match(html,/function nextStep\(\)/);
});
test('mobile authentication stays in one viewport with focused OTP controls',()=>{
  const html=read('auth.html');
  assert.match(html,/<body data-scroll-mode="viewport">/);
  assert.match(html,/class="card" data-scroll-region/);
  assert.match(html,/height:\s*100dvh/);
  assert.match(html,/grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  assert.match(html,/const codePending = Boolean\(awaitingCode\(\)\)/);
  assert.match(html,/codePending \|\| !\(surface === "driver" && role === "ride"\)/);
  assert.match(html,/class="small auth-support"/);
});
test('core customer and provider workspaces use stable mobile viewport shells',()=>{
  for(const file of ['ride-flow.html','ride-chat.html','driver.html','delivery-driver.html','driver-preview.html']){
    assert.match(read(file),/data-scroll-mode="viewport"/,file);
  }
  for(const file of ['app.html','index.html']) assert.match(read(file),/height:\s*100dvh/,file);
  assert.match(read('driver-home.html'),/height:\s*100dvh/);
  assert.match(read('partner-register-v2.html'),/class="action-bar"/);
});
test('compact admin navigation exposes all sections through an accessible menu',()=>{
  const html=read('admin/index.html');
  assert.match(html,/id="adminNavToggle"[^>]*aria-expanded="false"[^>]*aria-controls="nav"/);
  assert.match(html,/admin\/navigation\.css\?v=2/);
  assert.match(html,/admin\/app\.js\?v=9/);
  assert.match(read('admin/app.js'),/dataset.mobilePrimary/);
  const css=read('admin/navigation.css');
  assert.match(css,/\.sidebar.is-nav-expanded nav/);
  assert.match(css,/grid-template-columns:\s*minmax\(0,4fr\) minmax\(0,1fr\)/);
  assert.match(css,/\.admin-nav-toggle\[aria-expanded="true"\]/);
});
test('public preview shares dashboard styles and remains explicitly simulated',()=>{
  const html=read('driver-preview.html');
  assert.match(html,/aucune donnée ou action réelle/);
  assert.ok(html.includes('vasi-driver-dashboard.css?v=4'));
  assert.ok(html.includes('vasi-driver-dashboard.js?v=4'));
  assert.match(html,/viewport-fit=cover/);
});
test('driver bottom navigation keeps four primary destinations and moves opportunities into Menu',()=>{
  for(const file of ['driver.html','driver-preview.html']){
    const html=read(file);
    const bottomNav=html.match(/<nav class="driver-bottom-nav"[\s\S]*?<\/nav>/)?.[0] || '';
    assert.equal((bottomNav.match(/data-driver-tab=/g)||[]).length,4,file);
    assert.doesNotMatch(bottomNav,/data-driver-tab="discover"/,file);
    assert.match(bottomNav,/Accueil[\s\S]*Revenus[\s\S]*Messages[\s\S]*Menu/,file);
    assert.match(html,/onclick="showDriverView\('discover'\)"[\s\S]*?<b>Opportunités<\/b>/,file);
  }
  assert.match(read('vasi-driver-dashboard.css'),/grid-template-columns:\s*repeat\(4,/);
  assert.match(read('vasi-driver-dashboard.js'),/name === "discover" \? "menu" : name/);
});
test('mobile driver home raises the map and hides partial cards below it',()=>{
  const css=read('vasi-driver-dashboard.css');
  const preview=read('driver-preview.html');
  assert.match(css,/\[data-driver-view="home"\] \.driver-view-heading \{ margin: 0 2px 6px; \}/);
  assert.match(css,/data-driver-view="home"\]\s+\.home-column-side \{ display: none; \}/);
  assert.match(preview,/\.driver-view-heading\{margin:0 2px 6px\}/);
});
