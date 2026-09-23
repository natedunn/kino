import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { ConvexHttpClient } from 'convex/browser';
const { chromium } = await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);
const targets = [
 { name:'kino-preview-sept17', origin:'https://t3code-build-footer-marketing-pages-kino.hello-fc8.workers.dev', path:'/auth', start:'/api/auth/sign-in/social' },
 { name:'native-proof', origin:'https://kino-auth-v2-proof-c318c09d.hello-fc8.workers.dev', path:'/', start:'/api/auth/github/start' },
];
const output={recordedAt:new Date().toISOString(), conditions:'Same machine/network, sequential alternating targets; no CPU/network throttling. First observation is NOT a server cold start. Public pages differ in complexity. Synthetic proof sessions bypass OAuth.', targets, initiation:[], public:[], protected:[]};
const round=n=>Math.round(n*10)/10;
const browser=await chromium.launch();
let admin, refreshToken;
try {
 for(let i=0;i<23;i++) for(const t of i%2 ? [...targets].reverse():targets){
  const begin=performance.now();
  const r=await fetch(t.origin+t.start,{method:'POST',redirect:'manual',headers:{Origin:t.origin,'Content-Type':'application/json'},body:JSON.stringify(t.name==='native-proof'?{}:{provider:'github',callbackURL:t.origin+'/auth'})});
  const headersMs=performance.now()-begin;const json=await r.json();
  assert.equal(r.status,200);assert.equal(new URL(typeof json.redirect === 'string' ? json.redirect : json.url).hostname,'github.com');
  output.initiation.push({target:t.name,iteration:i,phase:i<3?'warmup':'measured',headersMs:round(headersMs),totalMs:round(performance.now()-begin)});
 }
 console.log('OAuth initiation: 20 measured samples per target, plus 3 warmups.');
 for(let i=0;i<10;i++) for(const t of i%2 ? [...targets].reverse():targets){
  const c=await browser.newContext();const p=await c.newPage();
  await p.goto(t.origin+t.path,{waitUntil:'load'});
  await p.waitForTimeout(500);
  const metrics=await p.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];const resources=performance.getEntriesByType('resource');return {ttfbMs:n.responseStart,documentMs:n.responseEnd,domContentLoadedMs:n.domContentLoadedEventEnd,loadMs:n.loadEventEnd,fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,scriptCount:resources.filter(r=>r.initiatorType==='script').length,resourceTransferBytes:resources.reduce((s,r)=>s+r.transferSize,0)};});
  output.public.push({target:t.name,iteration:i,cache:'fresh browser context',...metrics});await c.close();
 }
 console.log('Public document: 10 fresh browser contexts per target.');
 const deployment=JSON.parse(readFileSync(new URL('../cloud/deployment.json',import.meta.url)));
 assert.equal(deployment.type,'preview');assert.equal(deployment.name,'graceful-elephant-103');
 admin=new ConvexHttpClient(deployment.url);
 const key=parseEnv(readFileSync(new URL('../cloud/.env.deploy.local',import.meta.url),'utf8')).CONVEX_DEPLOY_KEY;
 assert.equal(key.split('|')[0].split(':').at(-1),deployment.name);admin.setAdminAuth(key);
 const [account]=await admin.function('fixtures:seed',undefined,{});
 const tokens=await admin.function('public:signIn','auth',{claims:{providerName:account.provider,providerAccountId:account.providerAccountId,profile:{}},issuer:'https://graceful-elephant-103.convex.site',accessTokenTtlSeconds:300,refreshTokenTtlSeconds:600});refreshToken=tokens.refreshToken;
 for(let i=0;i<10;i++){
  const c=await browser.newContext();const origin=targets[1].origin;
  await c.addCookies([{name:'__convexAuthJWT',value:tokens.accessToken},{name:'__convexAuthRefreshToken',value:tokens.refreshToken}].map(x=>({...x,url:origin,httpOnly:true,secure:true,sameSite:'Lax'})));
  await c.addInitScript(()=>{window.__pending=false;new MutationObserver(()=>{if(document.querySelector('#pending'))window.__pending=true;}).observe(document,{childList:true,subtree:true});});
  const p=await c.newPage();let adds=0,queries=0;
  p.on('request',r=>{if(new URL(r.url()).pathname==='/api/query')queries++;});
  p.on('websocket',ws=>ws.on('framesent',({payload})=>{try{const m=JSON.parse(payload.toString());adds+=(m.modifications||[]).filter(x=>x.type==='Add'&&JSON.stringify(x.args).includes('beta')).length;}catch{}}));
  const begin=performance.now();const response=await p.goto(origin+'/private/alpha');
  await p.locator('html[data-hydrated="true"]').waitFor();await p.locator('#counter').waitFor();
  const usefulMs=round(performance.now()-begin);assert.ok((await response.text()).includes('id="counter"'));
  const nav=await p.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return {ttfbMs:n.responseStart,documentMs:n.responseEnd};});
  await p.getByRole('link',{name:'Open beta'}).hover();await p.waitForTimeout(700);assert.equal(adds,1);
  const click=performance.now();await p.getByRole('link',{name:'Open beta'}).evaluate(el=>el.click());await p.getByRole('heading',{name:'Private beta'}).waitFor();
  const hoverClickMs=round(performance.now()-click);assert.equal(adds,1);assert.equal(queries,0);assert.equal(await p.evaluate(()=>window.__pending),false);
  output.protected.push({iteration:i,cache:'fresh browser context',...nav,usefulMs,hoverDwellMs:700,hoverClickMs,betaSubscriptionAdds:adds,browserHttpQueries:queries});await c.close();
 }
 console.log('Protected native SSR + hover: 10 fresh contexts, all assertions passed.');
} finally {
 if(refreshToken)await admin.function('public:signOut','auth',{refreshToken}).catch(()=>console.error('Fixture cleanup failed'));
 await browser.close();
 writeFileSync(new URL('../performance/results.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
}
